import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { IConversationRepository } from '../interfaces';
import type { Conversation, ConversationData, Message } from '../types';

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
    async create(data: ConversationData): Promise<Conversation> {
        const conversationId = uuidv4();
        const mainKey = this.getMainKey(conversationId);

        const conversationDataForHash: Record<string, string | number | boolean> = {
            title: data.title,
            projectId: data.projectId,
            timestamp: data.timestamp, // Assuming timestamp is a string/number representation
        };

        // Create the conversation metadata hash
        await this.redis.hset(mainKey, conversationDataForHash);

        // Note: Adding the conversationId to the project's conversation set
        // should be handled by the service layer coordinating with IProjectRepository.

        const newConversation: Conversation = {
            id: conversationId,
            ...data, // Spread original data which matches Conversation structure minus id
        };
        return newConversation;
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

    async updateMetadata(conversationId: string, data: Partial<Omit<ConversationData, 'projectId'>>): Promise<void> {
        const mainKey = this.getMainKey(conversationId);
        const updateData: Record<string, string> = {};
         if (data.title !== undefined) updateData.title = data.title;
         if (data.timestamp !== undefined) updateData.timestamp = String(data.timestamp); // Ensure string

        if (Object.keys(updateData).length > 0) {
            // Optional: Check if conversation exists first
            await this.redis.hset(mainKey, updateData);
        }
    }

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
        const messageStrings = await this.redis.lrange(messagesKey, start, end);
        const parsedMessages: Message[] = [];
        for (const msgStr of messageStrings) {
             try {
                 // TODO: Add more robust validation for the parsed message structure (e.g., using Zod)
                 const parsed = JSON.parse(msgStr);
                 if (parsed && typeof parsed === 'object' && parsed.role && parsed.content) {
                     parsedMessages.push(parsed as Message);
                 } else {
                      console.warn(`Invalid message structure found in conversation ${conversationId}: ${msgStr}`);
                      // Optionally push a placeholder error message
                 }
             } catch (e) {
                 console.error(`Failed to parse message for conversation ${conversationId}: ${msgStr}`, e);
                 // Optionally push a placeholder error message
                 // parsedMessages.push({ role: 'system', content: '[Error: Failed to parse message]' });
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
}