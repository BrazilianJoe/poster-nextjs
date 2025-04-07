import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { IPostRepository } from '../interfaces';
import type { Post, PostData } from '../types';

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
    // Thin wrapper for create
    async create(data: PostData): Promise<Post> {
        // Image prompts are handled separately via addImagePrompt
        return this.upsert(data, { mode: 'create' });
    }

    async getById(postId: string): Promise<Post | null> {
        const mainKey = this.getMainKey(postId);
        const data = await this.redis.hgetall(mainKey);

        if (!data) {
            return null; // Key doesn't exist
        }

        // Validate essential fields, allowing contentPieces_json to be string or object (array)
        if (typeof data.conversationId !== 'string' ||
            typeof data.targetPlatform !== 'string' ||
            typeof data.postType !== 'string' ||
            (typeof data.contentPieces_json !== 'string' && typeof data.contentPieces_json !== 'object')) { // Check type
            console.error(`Incomplete or invalid post data found for key: ${mainKey}`, data);
            return null;
        }

        let contentPieces: string[] = [];
        try {
            let parsed: any;
            if (typeof data.contentPieces_json === 'string') {
                parsed = JSON.parse(data.contentPieces_json);
            } else if (Array.isArray(data.contentPieces_json)) {
                // Assume it's already the array if it's an object (specifically, an array)
                parsed = data.contentPieces_json;
            }

            // Validate parsed structure
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                 contentPieces = parsed;
            } else {
                 console.error(`Parsed contentPieces_json is not an array of strings for post ${postId}:`, parsed);
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

    // Thin wrapper for update (handles only subset of fields as defined in interface)
    async update(postId: string, data: Partial<Omit<PostData, 'conversationId' | 'imagePrompts' | 'contentPieces'>>): Promise<Post> {
        const existingPost = await this.getById(postId);
        if (!existingPost) {
            throw new Error(`Post with ID ${postId} not found.`);
        }

        // Merge existing data with the partial update data for the allowed fields
        // Carry over conversationId and contentPieces from existing post
        const mergedData: PostData = {
            conversationId: existingPost.conversationId, // Keep existing
            targetPlatform: data.targetPlatform ?? existingPost.targetPlatform,
            postType: data.postType ?? existingPost.postType,
            imageLink: data.imageLink !== undefined ? data.imageLink : existingPost.imageLink, // Allow setting null
            contentPieces: existingPost.contentPieces, // Keep existing
        };

        // Call upsert to handle the update of the hash data
        return this.upsert(mergedData, { mode: 'update', postId: postId });
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

    // --- Upsert Implementation ---
    async upsert(data: PostData, options?: { mode?: 'create' | 'update', postId?: string }): Promise<Post> {
        const mode = options?.mode;
        const providedPostId = options?.postId;
        let effectivePostId: string;

        if (!mode) {
            throw new Error("Operation mode ('create' or 'update') must be specified in options.");
        }

        // Validate contentPieces format early
        if (!Array.isArray(data.contentPieces) || !data.contentPieces.every(item => typeof item === 'string')) {
            throw new Error("Invalid content pieces format: must be an array of strings.");
        }

        if (mode === 'update') {
            if (!providedPostId) {
                throw new Error('Post ID must be provided in options for update mode.');
            }
            // Verify post exists before update
            const keyExists = await this.redis.exists(this.getMainKey(providedPostId));
            if (!keyExists) {
                 throw new Error(`Post with ID ${providedPostId} not found for update.`);
            }
            effectivePostId = providedPostId;
        } else { // mode === 'create'
            if (providedPostId) {
                // Create with specific ID - check if it already exists
                const keyExists = await this.redis.exists(this.getMainKey(providedPostId));
                if (keyExists) {
                    throw new Error(`Post with ID ${providedPostId} already exists. Cannot create.`);
                }
                effectivePostId = providedPostId;
            } else {
                // Create with new ID
                effectivePostId = uuidv4();
            }
        }

        const mainKey = this.getMainKey(effectivePostId);

        // Prepare data hash using cleanHashData
        // Explicitly handle contentPieces stringification
        const postDataForHash = cleanHashData({
            conversationId: data.conversationId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            imageLink: data.imageLink, // Pass directly, cleanHashData handles null/undefined
            contentPieces_json: JSON.stringify(data.contentPieces), // Stringify here
        });

        // Perform Redis operation
        // Use hset which overwrites or creates fields. cleanHashData removes undefined/null fields
        // except for imageLink which might need explicit deletion if set to null.
        // However, hset with cleanHashData effectively handles setting fields or leaving them out.
        // Explicit hdel for null imageLink isn't strictly needed with cleanHashData.
        await this.redis.hset(mainKey, postDataForHash);

        // If imageLink was explicitly set to null in the input data, ensure it's removed from the hash
        // (cleanHashData removes nulls, so this might be redundant, but explicit for clarity)
        if (data.imageLink === null) {
            await this.redis.hdel(mainKey, 'imageLink');
        }


        // Note: Linking post to conversation (conv:<id>:posts) should happen in the service layer.
        // Note: Handling image prompts (post:<id>:prompts) happens via separate methods.

        // Return the final state of the post
        return {
            id: effectivePostId,
            conversationId: data.conversationId,
            targetPlatform: data.targetPlatform,
            postType: data.postType,
            imageLink: data.imageLink ?? null, // Ensure null if undefined/null in data
            contentPieces: data.contentPieces, // Return original array
        };
    }
}