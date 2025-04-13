import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { IPostRepository } from '../interfaces';
import type { Post, PostData } from '../types';
import { RedisConversationRepository } from './redisConversationRepository';

// Helper function (consider moving to a shared utils file)
// Ensures values are suitable for Redis hash (strings, numbers, booleans)
function cleanHashData(data: Record<string, any>): Record<string, string | number | boolean> {
    const cleaned: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            // Allow explicitly setting null for fields like imageLink via hdel later if needed
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                 cleaned[key] = value;
            } else {
                 // Stringify non-primitive types (like contentPieces_json)
                 cleaned[key] = JSON.stringify(value);
            }
        }
    }
    return cleaned;
}

export class RedisPostRepository implements IPostRepository {
    private redis: Redis;
    private keyPrefix: string;
    private imagePromptsSuffix = ':imagePrompts';
    private conversationsSuffix = ':conversations';
    private mediaLinksSuffix = ':media';

    constructor(redisClient: Redis, prefix: string = '') {
        this.redis = redisClient;
        this.keyPrefix = `${prefix}post:`;
    }

    // --- Key Generation ---
    private getMainKey(postId: string): string {
        return `${this.keyPrefix}${postId}`;
    }
    private getImagePromptsKey(postId: string): string {
        return `${this.getMainKey(postId)}${this.imagePromptsSuffix}`;
    }
    private getConversationsKey(postId: string): string {
        return `${this.getMainKey(postId)}${this.conversationsSuffix}`;
    }
    private getMediaLinksKey(postId: string): string {
        return `${this.getMainKey(postId)}${this.mediaLinksSuffix}`;
    }

    // --- Core CRUD ---
    async create(data: PostData): Promise<Post> {
        return this.upsert(data, { mode: 'create' });
    }

    async getById(postId: string): Promise<Post | null> {
        const mainKey = this.getMainKey(postId);
        const data = await this.redis.hgetall(mainKey);

        if (!data) {
            return null; // Key doesn't exist
        }

        // Validate essential fields, allowing contentPieces_json to be string or object (array)
        if (typeof data.projectId !== 'string' ||
            typeof data.targetPlatform !== 'string' ||
            typeof data.postType !== 'string' ||
            (typeof data.contentPieces_json !== 'string' && typeof data.contentPieces_json !== 'object')) {
            console.error(`Incomplete or invalid post data found for key: ${mainKey}`, data);
            return null;
        }

        let contentPieces: string[] = [];
        try {
            if (typeof data.contentPieces_json === 'string') {
                contentPieces = JSON.parse(data.contentPieces_json);
            } else if (Array.isArray(data.contentPieces_json)) {
                contentPieces = data.contentPieces_json;
            }

            if (!Array.isArray(contentPieces) || !contentPieces.every(item => typeof item === 'string')) {
                console.error(`Parsed contentPieces_json is not an array of strings for post ${postId}:`, contentPieces);
                contentPieces = [];
            }
        } catch (e) {
            console.error(`Failed to parse contentPieces_json for post ${postId}`, e);
            contentPieces = [];
        }

        // Get media links from the Set
        const mediaLinks = await this.getMediaLinks(postId);

        return {
            id: postId,
            projectId: data.projectId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            mediaLinks,
            contentPieces,
        };
    }

    async update(postId: string, data: Partial<Omit<PostData, 'projectId' | 'contentPieces'>>): Promise<Post> {
        const existingPost = await this.getById(postId);
        if (!existingPost) {
            throw new Error(`Post with ID ${postId} not found.`);
        }

        const mergedData: PostData = {
            projectId: existingPost.projectId,
            targetPlatform: data.targetPlatform || existingPost.targetPlatform,
            postType: data.postType || existingPost.postType,
            contentPieces: existingPost.contentPieces,
            mediaLinks: existingPost.mediaLinks,
        };

        return this.upsert(mergedData, { mode: 'update', postId });
    }

    async setContentPieces(postId: string, content: string[]): Promise<void> {
        const mainKey = this.getMainKey(postId);
        if (!Array.isArray(content) || !content.every(item => typeof item === 'string')) {
            throw new Error("Invalid content pieces format: must be an array of strings.");
        }
        await this.redis.hset(mainKey, { contentPieces_json: JSON.stringify(content) });
    }

    // --- Image Prompts (Set) ---
    async addImagePrompt(postId: string, prompt: string): Promise<void> {
        const promptsKey = this.getImagePromptsKey(postId);
        await this.redis.sadd(promptsKey, prompt);
    }

    async removeImagePrompt(postId: string, prompt: string): Promise<void> {
        const promptsKey = this.getImagePromptsKey(postId);
        await this.redis.srem(promptsKey, prompt);
    }

    async getImagePrompts(postId: string): Promise<string[]> {
        const promptsKey = this.getImagePromptsKey(postId);
        return await this.redis.smembers(promptsKey);
    }

    // --- Project Relationships ---
    async getProjectId(postId: string): Promise<string | null> {
        const mainKey = this.getMainKey(postId);
        const projectId = await this.redis.hget(mainKey, 'projectId');
        return typeof projectId === 'string' ? projectId : null;
    }

    // --- Conversation Relationships (0:n) ---
    async addConversation(postId: string, conversationId: string): Promise<void> {
        const conversationsKey = this.getConversationsKey(postId);
        await this.redis.sadd(conversationsKey, conversationId);
    }

    async removeConversation(postId: string, conversationId: string): Promise<void> {
        const conversationsKey = this.getConversationsKey(postId);
        await this.redis.srem(conversationsKey, conversationId);
    }

    async getConversationIds(postId: string): Promise<string[]> {
        const conversationsKey = this.getConversationsKey(postId);
        return await this.redis.smembers(conversationsKey);
    }

    // --- Media Links (Set) ---
    async addMediaLink(postId: string, mediaLink: string): Promise<void> {
        const mediaLinksKey = this.getMediaLinksKey(postId);
        await this.redis.sadd(mediaLinksKey, mediaLink);
    }

    async removeMediaLink(postId: string, mediaLink: string): Promise<void> {
        const mediaLinksKey = this.getMediaLinksKey(postId);
        await this.redis.srem(mediaLinksKey, mediaLink);
    }

    async getMediaLinks(postId: string): Promise<string[]> {
        const mediaLinksKey = this.getMediaLinksKey(postId);
        return await this.redis.smembers(mediaLinksKey);
    }

    async delete(postId: string): Promise<void> {
        const mainKey = this.getMainKey(postId);
        const promptsKey = this.getImagePromptsKey(postId);
        const conversationsKey = this.getConversationsKey(postId);
        const mediaLinksKey = this.getMediaLinksKey(postId);
        
        const pipe = this.redis.pipeline();
        pipe.del(mainKey);
        pipe.del(promptsKey);
        pipe.del(conversationsKey);
        pipe.del(mediaLinksKey);
        await pipe.exec();
    }

    async upsert(data: PostData, options?: { mode?: 'create' | 'update', postId?: string }): Promise<Post> {
        const mode = options?.mode;
        const providedPostId = options?.postId;
        let effectivePostId: string;

        if (!mode) {
            throw new Error("Operation mode ('create' or 'update') must be specified in options.");
        }

        if (mode === 'update') {
            if (!providedPostId) {
                throw new Error('Post ID must be provided in options for update mode.');
            }
            const keyExists = await this.redis.exists(this.getMainKey(providedPostId));
            if (!keyExists) {
                throw new Error(`Post with ID ${providedPostId} not found for update.`);
            }
            effectivePostId = providedPostId;
        } else { // mode === 'create'
            if (providedPostId) {
                const keyExists = await this.redis.exists(this.getMainKey(providedPostId));
                if (keyExists) {
                    throw new Error(`Post with ID ${providedPostId} already exists. Cannot create.`);
                }
                effectivePostId = providedPostId;
            } else {
                effectivePostId = uuidv4();
            }
        }

        const mainKey = this.getMainKey(effectivePostId);
        const postDataForHash = cleanHashData({
            projectId: data.projectId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            contentPieces_json: data.contentPieces,
        });

        await this.redis.hset(mainKey, postDataForHash);

        // Add media links to the Set
        if (data.mediaLinks.length > 0) {
            const mediaLinksKey = this.getMediaLinksKey(effectivePostId);
            await this.redis.sadd(mediaLinksKey, data.mediaLinks);
        }

        return {
            id: effectivePostId,
            projectId: data.projectId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            mediaLinks: data.mediaLinks,
            contentPieces: data.contentPieces,
        };
    }
}