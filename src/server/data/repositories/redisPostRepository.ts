import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { IPostRepository } from '../interfaces';
import type { Post, PostData } from '../types';

export class RedisPostRepository implements IPostRepository {
    private redis: Redis;
    private keyPrefix = 'post:';
    private imagePromptsSuffix = ':prompts';

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    // --- Key Generation ---
    private getMainKey(postId: string): string {
        return `${this.keyPrefix}${postId}`;
    }
    private getImagePromptsKey(postId: string): string {
        return `${this.getMainKey(postId)}${this.imagePromptsSuffix}`;
    }

    // --- Core CRUD ---
    async create(data: PostData): Promise<Post> {
        const postId = uuidv4();
        const mainKey = this.getMainKey(postId);

        const postDataForHash: Record<string, string | number | boolean> = {
            conversationId: data.conversationId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            contentPieces_json: JSON.stringify(data.contentPieces), // Store as JSON string
            // Only include imageLink if it's provided and not null
            ...(data.imageLink && { imageLink: data.imageLink }),
        };

        // Create the post hash
        await this.redis.hset(mainKey, postDataForHash);

        // Note: Adding the postId to the conversation's post set
        // should be handled by the service layer coordinating with IConversationRepository.

        const newPost: Post = {
            id: postId,
            conversationId: data.conversationId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            imageLink: data.imageLink ?? null, // Ensure null if undefined
            contentPieces: data.contentPieces,
        };
        return newPost;
    }

    async getById(postId: string): Promise<Post | null> {
        const mainKey = this.getMainKey(postId);
        const data = await this.redis.hgetall(mainKey);

        if (!data) {
            return null; // Key doesn't exist
        }

        // Validate essential fields
        if (typeof data.conversationId !== 'string' || typeof data.targetPlatform !== 'string' || typeof data.postType !== 'string' || typeof data.contentPieces_json !== 'string') {
            console.error(`Incomplete or invalid post data found for key: ${mainKey}`, data);
            return null;
        }

        let contentPieces: string[] = [];
        try {
            const parsed = JSON.parse(data.contentPieces_json);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                 contentPieces = parsed;
            } else {
                 console.error(`contentPieces_json is not an array of strings for post ${postId}`);
                 // Default to empty array or handle error as appropriate
            }
        } catch (e) {
            console.error(`Failed to parse contentPieces_json for post ${postId}`, e);
             // Default to empty array or handle error as appropriate
        }


        return {
            id: postId,
            conversationId: data.conversationId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            imageLink: typeof data.imageLink === 'string' ? data.imageLink : null, // Handle optional field
            contentPieces: contentPieces,
        };
    }

    async update(postId: string, data: Partial<Omit<PostData, 'conversationId' | 'imagePrompts' | 'contentPieces'>>): Promise<void> {
        const mainKey = this.getMainKey(postId);
        const updateData: Record<string, string> = {};

        if (data.targetPlatform !== undefined) updateData.targetPlatform = data.targetPlatform;
        if (data.postType !== undefined) updateData.postType = data.postType;
        // Handle imageLink carefully: allow setting to null via hdel
        if (data.imageLink !== undefined && data.imageLink !== null) {
             updateData.imageLink = data.imageLink;
        }

        const pipe = this.redis.pipeline();
        let needsExec = false;

        if (Object.keys(updateData).length > 0) {
            pipe.hset(mainKey, updateData);
            needsExec = true;
        }

        // Explicitly handle setting imageLink to null by deleting the field
        if (data.imageLink === null) {
            pipe.hdel(mainKey, 'imageLink');
            needsExec = true;
        }

        if (needsExec) {
             // Optional: Check if post exists first
            await pipe.exec();
        }
    }

     async setContentPieces(postId: string, content: string[]): Promise<void> {
         const mainKey = this.getMainKey(postId);
         // Optional: Check if post exists first
         // Ensure content is string array before stringifying
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

    async getConversationId(postId: string): Promise<string | null> {
        const mainKey = this.getMainKey(postId);
        const conversationId = await this.redis.hget<string>(mainKey, 'conversationId');
        return conversationId; // Already string | null
    }
}