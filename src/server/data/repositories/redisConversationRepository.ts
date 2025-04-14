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
    private keyPrefix: string;
    private messagesSuffix = ':messages';
    private postsSuffix = ':posts';

    constructor(redisClient: Redis, prefix: string = '') {
        this.redis = redisClient;
        this.keyPrefix = `${prefix}conv:`;
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

    async create(data: ConversationData): Promise<Conversation> {
        return this.upsert(data, { mode: 'create' });
    }

    async getMetadataById(conversationId: string): Promise<Conversation | null> {
        return this.getById(conversationId);
    }

    async getById(conversationId: string): Promise<Conversation | null> {
        const mainKey = this.getMainKey(conversationId);
        const data = await this.redis.hgetall(mainKey);

        if (!data) {
            return null;
        }

        // Validate essential fields
        if (typeof data.projectId !== 'string' || typeof data.title !== 'string') {
            console.error(`Incomplete or invalid conversation data found for key: ${mainKey}`, data);
            return null;
        }

        return {
            id: conversationId,
            projectId: data.projectId,
            title: data.title,
        };
    }

    async update(conversationId: string, data: Partial<ConversationData>): Promise<Conversation> {
        const existingConversation = await this.getById(conversationId);
        if (!existingConversation) {
            throw new Error(`Conversation with ID ${conversationId} not found.`);
        }

        const mergedData: ConversationData = {
            projectId: existingConversation.projectId,
            title: data.title || existingConversation.title,
        };

        return this.upsert(mergedData, { mode: 'update', conversationId });
    }

    async setProject(conversationId: string, projectId: string): Promise<void> {
        const mainKey = this.getMainKey(conversationId);
        await this.redis.hset(mainKey, { projectId });
    }

    async getProjectId(conversationId: string): Promise<string | null> {
        const mainKey = this.getMainKey(conversationId);
        const data = await this.redis.hget(mainKey, 'projectId');
        return typeof data === 'string' ? data : null;
    }

    async addMessage(conversationId: string, message: Message): Promise<void> {
        const messagesKey = this.getMessagesKey(conversationId);
        // Ensure timestamp is set if not provided
        const messageWithTimestamp = {
            ...message,
            timestamp: message.timestamp || new Date().toISOString()
        };
        await this.redis.rpush(messagesKey, JSON.stringify(messageWithTimestamp));
    }

    async getMessages(conversationId: string, start: number = 0, end: number = -1): Promise<Message[]> {
        const messagesKey = this.getMessagesKey(conversationId);
        const messages = await this.redis.lrange(messagesKey, start, end);
        return messages.map(msg => JSON.parse(msg));
    }

    async getRecentMessages(conversationId: string, count: number): Promise<Message[]> {
        const messagesKey = this.getMessagesKey(conversationId);
        const messages = await this.redis.lrange(messagesKey, -count, -1);
        return messages.map(msg => JSON.parse(msg));
    }

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

    async delete(conversationId: string): Promise<void> {
        const mainKey = this.getMainKey(conversationId);
        const messagesKey = this.getMessagesKey(conversationId);
        const postsKey = this.getPostsKey(conversationId);
        
        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();
        pipe.del(mainKey);
        pipe.del(messagesKey);
        pipe.del(postsKey);
        await pipe.exec();
    }

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
            const keyExists = await this.redis.exists(this.getMainKey(providedConversationId));
            if (!keyExists) {
                throw new Error(`Conversation with ID ${providedConversationId} not found for update.`);
            }
            effectiveConversationId = providedConversationId;
        } else { // mode === 'create'
            if (providedConversationId) {
                const keyExists = await this.redis.exists(this.getMainKey(providedConversationId));
                if (keyExists) {
                    throw new Error(`Conversation with ID ${providedConversationId} already exists. Cannot create.`);
                }
                effectiveConversationId = providedConversationId;
            } else {
                effectiveConversationId = uuidv4();
            }
        }

        const mainKey = this.getMainKey(effectiveConversationId);
        const conversationDataForHash = cleanHashData({
            projectId: data.projectId,
            title: data.title,
        });

        await this.redis.hset(mainKey, conversationDataForHash);

        return {
            id: effectiveConversationId,
            projectId: data.projectId,
            title: data.title,
        };
    }
}