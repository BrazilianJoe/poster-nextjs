import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { IConversationRepository } from '../interfaces';
import type { Conversation, ConversationData, Message } from '../types';

// Helper function (consider moving to a shared utils file)
// Ensures values are suitable for Redis hash (strings, numbers, booleans)
function cleanHashData(data: Record<string, any>): Record<string, string | number | boolean> {
    const cleaned: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                 cleaned[key] = value;
            } else {
                 cleaned[key] = JSON.stringify(value);
            }
        }
    }
    return cleaned;
}


export class RedisConversationRepository implements IConversationRepository {
    private redis: Redis;
    private keyPrefix = 'conv:';
    private messagesSuffix = ':messages';
    private postsSuffix = ':posts';

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    // --- Key Generation ---
    private getMainKey(conversationId: string): string {
        return `${this.keyPrefix}${conversationId}`;
    }
    private getMessagesKey(conversationId: string): string {
        return `${this.getMainKey(conversationId)}${this.messagesSuffix}`;
    }
    private getPostsKey(conversationId: string): string {
        return `${this.getMainKey(conversationId)}${this.postsSuffix}`;
    }

    // --- Core CRUD ---
    // Thin wrapper for create
    async create(data: ConversationData): Promise<Conversation> {
        return this.upsert(data, { mode: 'create' });
    }

    // Thin wrapper for update
    async update(conversationId: string, data: Partial<ConversationData>): Promise<Conversation> {
        const existingConversation = await this.getMetadataById(conversationId);
        if (!existingConversation) {
            throw new Error(`Conversation with ID ${conversationId} not found.`);
        }
        // Merge existing data with the partial update data
        const mergedData: ConversationData = {
            title: data.title ?? existingConversation.title,
            projectId: data.projectId ?? existingConversation.projectId,
            timestamp: data.timestamp ?? existingConversation.timestamp,
        };
        return this.upsert(mergedData, { mode: 'update', conversationId: conversationId });
    }

    async getMetadataById(conversationId: string): Promise<Conversation | null> {
        const mainKey = this.getMainKey(conversationId);
        const data = await this.redis.hgetall(mainKey);

        if (!data) {
            return null; // Key doesn't exist
        }

        // Validate essential fields
        if (typeof data.title !== 'string' || typeof data.projectId !== 'string' || typeof data.timestamp === 'undefined') { // Check timestamp presence
            console.error(`Incomplete or invalid conversation metadata found for key: ${mainKey}`, data);
            return null;
        }

        return {
            id: conversationId,
            title: data.title,
            projectId: data.projectId,
            timestamp: String(data.timestamp), // Ensure timestamp is string
        };
    }

    // updateMetadata removed as it's replaced by the general update method

    async setProject(conversationId: string, projectId: string): Promise<void> {
        const mainKey = this.getMainKey(conversationId);
        // Optional: Check if conversation exists first
        await this.redis.hset(mainKey, { projectId: projectId });
        // Note: Updating the project's conversation sets (removing from old, adding to new)
        // must be handled by the service layer coordinating with IProjectRepository.
    }

    async getProjectId(conversationId: string): Promise<string | null> {
        const mainKey = this.getMainKey(conversationId);
        const projectId = await this.redis.hget<string>(mainKey, 'projectId');
        return projectId; // Already string | null
    }

    // --- Messages (List) ---
    async addMessage(conversationId: string, message: Message): Promise<void> {
        const messagesKey = this.getMessagesKey(conversationId);
        // Add timestamp if missing? Or assume it's provided. Let's ensure it exists.
        const messageWithTimestamp = { ...message, timestamp: message.timestamp ?? Date.now().toString() };
        try {
            const messageString = JSON.stringify(messageWithTimestamp);
            await this.redis.rpush(messagesKey, messageString);
        } catch (e) {
             console.error(`Failed to stringify message for conversation ${conversationId}:`, messageWithTimestamp, e);
             // Decide how to handle - throw error? Log and skip?
             throw new Error(`Failed to serialize message for conversation ${conversationId}`);
        }
    }

    async getMessages(conversationId: string, start: number = 0, end: number = -1): Promise<Message[]> {
        const messagesKey = this.getMessagesKey(conversationId);
        // lrange might return strings or already parsed objects depending on client/data
        const messageItems = await this.redis.lrange(messagesKey, start, end);
        const parsedMessages: Message[] = [];

        for (const item of messageItems) {
            let parsed: any = null;
            try {
                if (typeof item === 'string') {
                    parsed = JSON.parse(item);
                } else if (item && typeof item === 'object') {
                    // Assume it's already the object we want if not a string
                    parsed = item;
                }

                // Validate the structure (basic check)
                // TODO: Add more robust validation (e.g., using Zod)
                if (parsed && typeof parsed === 'object' && parsed.role && parsed.content) {
                    // Ensure timestamp is string if present (it should be added by addMessage)
                    if (parsed.timestamp !== undefined) {
                        parsed.timestamp = String(parsed.timestamp);
                    }
                    parsedMessages.push(parsed as Message);
                } else {
                    console.warn(`Invalid or unexpected message structure found in conversation ${conversationId}:`, item);
                }
            } catch (e) {
                console.error(`Failed to process message item for conversation ${conversationId}:`, item, e);
                // Optionally push a placeholder error message
                // parsedMessages.push({ role: 'system', content: '[Error: Failed to process message]' });
             }
        }
         return parsedMessages;
    }

    async getRecentMessages(conversationId: string, count: number): Promise<Message[]> {
        if (count <= 0) return [];
        // LRANGE end index is inclusive, so to get last 'count' items, end is -1, start is -count
        return this.getMessages(conversationId, -count, -1);
    }

    // --- Post Relationships ---
    async addPost(conversationId: string, postId: string): Promise<void> {
        const postsKey = this.getPostsKey(conversationId);
        await this.redis.sadd(postsKey, postId);
    }

    async removePost(conversationId: string, postId: string): Promise<void> {
        const postsKey = this.getPostsKey(conversationId);
        await this.redis.srem(postsKey, postId);
    }

    async getPostIds(conversationId: string): Promise<string[]> {
        const postsKey = this.getPostsKey(conversationId);
        return await this.redis.smembers(postsKey);
    }

    // --- Upsert Implementation ---
    async upsert(data: ConversationData, options?: { mode?: 'create' | 'update', conversationId?: string }): Promise<Conversation> {
        const mode = options?.mode;
        const providedConversationId = options?.conversationId;
        let effectiveConversationId: string;

        if (!mode) {
            throw new Error("Operation mode ('create' or 'update') must be specified in options.");
        }

        if (mode === 'update') {
            if (!providedConversationId) {
                throw new Error('Conversation ID must be provided in options for update mode.');
            }
            // Verify conversation exists before update
            const keyExists = await this.redis.exists(this.getMainKey(providedConversationId));
            if (!keyExists) {
                 throw new Error(`Conversation with ID ${providedConversationId} not found for update.`);
            }
            effectiveConversationId = providedConversationId;
        } else { // mode === 'create'
            if (providedConversationId) {
                // Create with specific ID - check if it already exists
                const keyExists = await this.redis.exists(this.getMainKey(providedConversationId));
                if (keyExists) {
                    throw new Error(`Conversation with ID ${providedConversationId} already exists. Cannot create.`);
                }
                effectiveConversationId = providedConversationId;
            } else {
                // Create with new ID
                effectiveConversationId = uuidv4();
            }
        }

        const mainKey = this.getMainKey(effectiveConversationId);

        // Prepare data hash using cleanHashData
        const conversationDataForHash = cleanHashData({
            title: data.title,
            projectId: data.projectId,
            timestamp: data.timestamp, // Pass string directly
        });

        // Perform Redis operation
        await this.redis.hset(mainKey, conversationDataForHash);

        // Note: Linking conversation to project (proj:<id>:conversations) should happen in the service layer.

        // Return the final state of the conversation
        return {
            id: effectiveConversationId,
            title: data.title,
            projectId: data.projectId,
            timestamp: data.timestamp,
        };
    }
}