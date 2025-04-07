import 'dotenv/config'; // Load .env variables

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Redis } from '@upstash/redis';
import { RedisPostRepository } from './redisPostRepository';
import type { Post, PostData } from '../types';
import type { IPostRepository } from '../interfaces';

// Basic check for environment variables
if (!process.env.TEST_UPSTASH_REDIS_REST_URL || !process.env.TEST_UPSTASH_REDIS_REST_TOKEN) {
    console.warn("Missing TEST Redis environment variables. Skipping integration tests.");
}

// Use describe.skipIf to conditionally skip tests if env vars are missing
const describeIf = (process.env.TEST_UPSTASH_REDIS_REST_URL && process.env.TEST_UPSTASH_REDIS_REST_TOKEN) ? describe : describe.skip;

describeIf('RedisPostRepository Integration Tests', () => {
    let redis: Redis;
    let postRepository: IPostRepository; // Use interface type

    // Use test credentials safely
    const redisUrl = process.env.TEST_UPSTASH_REDIS_REST_URL!;
    const redisToken = process.env.TEST_UPSTASH_REDIS_REST_TOKEN!;

    beforeAll(() => {
        redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });
        postRepository = new RedisPostRepository(redis);
    });

    beforeEach(async () => {
        // Clean the database before each test
        await redis.flushdb();
    });

    // --- Core CRUD Tests ---

    it('should create a new post with full data and retrieve it by ID', async () => {
        const conversationId = 'convo-post-123';
        const postData: PostData = {
            conversationId: conversationId,
            targetPlatform: 'Twitter',
            postType: 'Thread',
            imageLink: 'http://example.com/image.jpg',
            contentPieces: ['Piece 1', 'Piece 2: The Sequel'],
        };

        const createdPost = await postRepository.create(postData);

        // Check the returned post object
        expect(createdPost).toBeDefined();
        expect(createdPost.id).toBeTypeOf('string');
        expect(createdPost.conversationId).toBe(conversationId);
        expect(createdPost.targetPlatform).toBe(postData.targetPlatform);
        expect(createdPost.postType).toBe(postData.postType);
        expect(createdPost.imageLink).toBe(postData.imageLink);
        expect(createdPost.contentPieces).toEqual(postData.contentPieces);

        // Verify by fetching from Redis
        const retrievedPost = await postRepository.getById(createdPost.id);
        expect(retrievedPost).not.toBeNull();
        expect(retrievedPost).toEqual(createdPost);
    });

    it('should create a post with minimal data (no imageLink) and retrieve it', async () => {
        const conversationId = 'convo-post-min';
        const postData: PostData = {
            conversationId: conversationId,
            targetPlatform: 'LinkedIn',
            postType: 'Article Snippet',
            contentPieces: ['Intro paragraph.'],
            // imageLink is omitted
        };

        const createdPost = await postRepository.create(postData);

        expect(createdPost).toBeDefined();
        expect(createdPost.id).toBeTypeOf('string');
        expect(createdPost.conversationId).toBe(conversationId);
        expect(createdPost.targetPlatform).toBe(postData.targetPlatform);
        expect(createdPost.postType).toBe(postData.postType);
        expect(createdPost.imageLink).toBeNull(); // Should default to null
        expect(createdPost.contentPieces).toEqual(postData.contentPieces);

        const retrievedPost = await postRepository.getById(createdPost.id);
        expect(retrievedPost).not.toBeNull();
        expect(retrievedPost).toEqual(createdPost);
        expect(retrievedPost?.imageLink).toBeNull();
    });

    it('should return null when getting a post by non-existent ID', async () => {
        const nonExistentId = 'non-existent-post-id-xyz';
        const retrievedPost = await postRepository.getById(nonExistentId);
        expect(retrievedPost).toBeNull();
    });

    it('should update post metadata using the update method', async () => {
        const conversationId = 'convo-post-upd';
        const initialData: PostData = {
            conversationId: conversationId,
            targetPlatform: 'Blog',
            postType: 'Draft',
            imageLink: 'http://initial.com/img.png',
            contentPieces: ['Initial content'],
        };
        const post = await postRepository.create(initialData);

        // Update subset of fields
        const updates: Partial<Omit<PostData, 'conversationId' | 'imagePrompts' | 'contentPieces'>> = {
            targetPlatform: 'Newsletter',
            postType: 'Published',
            imageLink: 'http://updated.com/pic.jpg',
        };
        const updatedPost = await postRepository.update(post.id, updates);

        // Check returned value from update
        expect(updatedPost.targetPlatform).toBe(updates.targetPlatform);
        expect(updatedPost.postType).toBe(updates.postType);
        expect(updatedPost.imageLink).toBe(updates.imageLink);
        // Verify unchanged fields
        expect(updatedPost.conversationId).toBe(conversationId);
        expect(updatedPost.contentPieces).toEqual(['Initial content']);

        // Verify by fetching
        const fetchedPost = await postRepository.getById(post.id);
        expect(fetchedPost).toEqual(updatedPost);
    });

     it('should update post metadata setting imageLink to null using the update method', async () => {
        const conversationId = 'convo-post-upd-null';
        const initialData: PostData = {
            conversationId: conversationId,
            targetPlatform: 'Instagram',
            postType: 'Story',
            imageLink: 'http://initial.com/img.png',
            contentPieces: ['Some text'],
        };
        const post = await postRepository.create(initialData);
        expect(post.imageLink).toBe('http://initial.com/img.png'); // Verify initial state

        // Update subset of fields, setting imageLink to null
        const updates: Partial<Omit<PostData, 'conversationId' | 'imagePrompts' | 'contentPieces'>> = {
            targetPlatform: 'Facebook',
            imageLink: null,
        };
        const updatedPost = await postRepository.update(post.id, updates);

        // Check returned value from update
        expect(updatedPost.targetPlatform).toBe(updates.targetPlatform);
        expect(updatedPost.imageLink).toBeNull(); // Check if null
        // Verify unchanged fields
        expect(updatedPost.conversationId).toBe(conversationId);
        expect(updatedPost.postType).toBe('Story'); // Unchanged
        expect(updatedPost.contentPieces).toEqual(['Some text']);

        // Verify by fetching
        const fetchedPost = await postRepository.getById(post.id);
        expect(fetchedPost).toEqual(updatedPost);
        expect(fetchedPost?.imageLink).toBeNull(); // Explicit check after fetch
    });

    it('should set content pieces', async () => {
        const conversationId = 'convo-post-content';
        const initialData: PostData = {
            conversationId: conversationId,
            targetPlatform: 'Dev.to',
            postType: 'Tutorial',
            contentPieces: ['Step 1'],
        };
        const post = await postRepository.create(initialData);

        const newContent = ['Step 1: Refactored', 'Step 2: Added', 'Step 3: Profit?'];
        await postRepository.setContentPieces(post.id, newContent);

        const updatedPost = await postRepository.getById(post.id);
        expect(updatedPost?.contentPieces).toEqual(newContent);
    });

    it('should get the correct conversation ID', async () => {
        const conversationId = 'convo-get-id-test';
        const initialData: PostData = {
            conversationId: conversationId,
            targetPlatform: 'Test',
            postType: 'Test',
            contentPieces: ['Test'],
        };
        const post = await postRepository.create(initialData);

        const retrievedConvId = await postRepository.getConversationId(post.id);
        expect(retrievedConvId).toBe(conversationId);
    });

    // --- Image Prompt Tests ---

    it('should add, remove, and get image prompts', async () => {
        const conversationId = 'convo-img-prompt';
        const postData: PostData = {
            conversationId: conversationId,
            targetPlatform: 'Midjourney',
            postType: 'Image Generation',
            contentPieces: ['Base idea'],
        };
        const post = await postRepository.create(postData);
        const prompt1 = 'Cyberpunk cat riding a unicorn';
        const prompt2 = 'Synthwave sunset over a neon city';

        // Initial state
        expect(await postRepository.getImagePrompts(post.id)).toEqual([]);

        // Add prompts
        await postRepository.addImagePrompt(post.id, prompt1);
        await postRepository.addImagePrompt(post.id, prompt2);
        let imagePrompts = await postRepository.getImagePrompts(post.id);
        // Order isn't guaranteed in sets, so check for presence and length
        expect(imagePrompts).toHaveLength(2);
        expect(imagePrompts).toContain(prompt1);
        expect(imagePrompts).toContain(prompt2);

        // Remove a prompt
        await postRepository.removeImagePrompt(post.id, prompt1);
        imagePrompts = await postRepository.getImagePrompts(post.id);
        expect(imagePrompts).toHaveLength(1);
        expect(imagePrompts).toEqual([prompt2]); // Only prompt2 should remain

        // Remove the other prompt
        await postRepository.removeImagePrompt(post.id, prompt2);
        imagePrompts = await postRepository.getImagePrompts(post.id);
        expect(imagePrompts).toEqual([]);
    });
});