import 'dotenv/config'; // Load .env variables

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { Redis } from '@upstash/redis';
import { RedisConversationRepository } from './redisConversationRepository';
import type { Conversation, ConversationData, Message } from '../types';
import type { IConversationRepository } from '../interfaces';

// Basic check for environment variables
if (!process.env.TEST_UPSTASH_REDIS_REST_URL || !process.env.TEST_UPSTASH_REDIS_REST_TOKEN) {
    console.warn("Missing TEST Redis environment variables. Skipping integration tests.");
}

// Use describe.skipIf to conditionally skip tests if env vars are missing
const describeIf = (process.env.TEST_UPSTASH_REDIS_REST_URL && process.env.TEST_UPSTASH_REDIS_REST_TOKEN) ? describe : describe.skip;

describeIf('RedisConversationRepository Integration Tests', () => {
    let redis: Redis;
    let conversationRepository: IConversationRepository; // Use interface type

    // Use test credentials safely
    const redisUrl = process.env.TEST_UPSTASH_REDIS_REST_URL!;
    const redisToken = process.env.TEST_UPSTASH_REDIS_REST_TOKEN!;

    beforeAll(() => {
        redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });
        conversationRepository = new RedisConversationRepository(redis);
    });

    beforeEach(async () => {
        // Clean the database before each test
        await redis.flushdb();
        // Reset mocks if any (though none used here yet)
        vi.resetAllMocks();
    });

    // --- Metadata Tests ---

    it('should create a new conversation and retrieve its metadata by ID', async () => {
        const projectId = 'proj-meta-123';
        const conversationData: ConversationData = {
            title: 'Test Conversation Metadata',
            projectId: projectId,
        };

        const createdConversation = await conversationRepository.create(conversationData);

        // Check the returned conversation object
        expect(createdConversation).toBeDefined();
        expect(createdConversation.id).toBeTypeOf('string');
        expect(createdConversation.title).toBe(conversationData.title);
        expect(createdConversation.projectId).toBe(projectId);

        // Verify by fetching metadata from Redis
        const retrievedMetadata = await conversationRepository.getMetadataById(createdConversation.id);
        expect(retrievedMetadata).not.toBeNull();
        expect(retrievedMetadata).toEqual(createdConversation);
    });

    it('should return null when getting metadata by non-existent ID', async () => {
        const nonExistentId = 'non-existent-convo-id-meta';
        const retrievedMetadata = await conversationRepository.getMetadataById(nonExistentId);
        expect(retrievedMetadata).toBeNull();
    });

    it('should update conversation metadata using the general update method', async () => {
        const initialProjectId = 'proj-upd-initial';
        const initialData: ConversationData = { title: 'Before Update', projectId: initialProjectId };
        const conversation = await conversationRepository.create(initialData);

        const updatedProjectId = 'proj-upd-final';
        const updates: Partial<ConversationData> = {
            title: 'After Update',
            projectId: updatedProjectId,
        };
        const updatedConversation = await conversationRepository.update(conversation.id, updates);

        // Check returned value from update
        expect(updatedConversation.title).toBe(updates.title);
        expect(updatedConversation.projectId).toBe(updatedProjectId);

        // Verify by fetching metadata
        const fetchedMetadata = await conversationRepository.getMetadataById(conversation.id);
        expect(fetchedMetadata).toEqual(updatedConversation);
    });

    it('should set a new project ID and get the project ID', async () => {
        const projectA = 'proj-A-link';
        const projectB = 'proj-B-link';
        const initialData: ConversationData = { title: 'Project Linking Test', projectId: projectA };
        const conversation = await conversationRepository.create(initialData);

        // Verify initial state
        expect(await conversationRepository.getProjectId(conversation.id)).toBe(projectA);

        // Set new project
        await conversationRepository.setProject(conversation.id, projectB);

        // Verify new state
        expect(await conversationRepository.getProjectId(conversation.id)).toBe(projectB);
        const updatedMetadata = await conversationRepository.getMetadataById(conversation.id);
        expect(updatedMetadata?.projectId).toBe(projectB);
    });

    // --- Message Tests ---

    it('should add messages and retrieve them', async () => {
        const projectId = 'proj-msg-123';
        const conversationData: ConversationData = { title: 'Message Test Convo', projectId };
        const conversation = await conversationRepository.create(conversationData);

        const message1: Message = { role: 'user', content: 'Hello there!' };
        const message2: Message = { role: 'assistant', content: 'General Kenobi!' };
        const message3: Message = { role: 'user', content: 'How are you?' };

        await conversationRepository.addMessage(conversation.id, message1);
        await conversationRepository.addMessage(conversation.id, message2);
        await conversationRepository.addMessage(conversation.id, message3);

        const allMessages = await conversationRepository.getMessages(conversation.id);
        expect(allMessages).toHaveLength(3);
        // Check content and role, ignore timestamp added by addMessage for simplicity unless critical
        expect(allMessages[0]?.role).toBe(message1.role);
        expect(allMessages[0]?.content).toBe(message1.content);
        expect(allMessages[1]?.role).toBe(message2.role);
        expect(allMessages[1]?.content).toBe(message2.content);
        expect(allMessages[2]?.role).toBe(message3.role);
        expect(allMessages[2]?.content).toBe(message3.content);
        // Check if timestamps were added
        expect(allMessages[0]?.timestamp).toBeTypeOf('string');
        expect(allMessages[1]?.timestamp).toBeTypeOf('string');
        expect(allMessages[2]?.timestamp).toBeTypeOf('string');
    });

    it('should retrieve recent messages correctly', async () => {
        const projectId = 'proj-msg-recent';
        const conversationData: ConversationData = { title: 'Recent Message Test', projectId };
        const conversation = await conversationRepository.create(conversationData);

        const messages: Message[] = [
            { role: 'user', content: 'Msg 1' },
            { role: 'assistant', content: 'Msg 2' },
            { role: 'user', content: 'Msg 3' },
            { role: 'assistant', content: 'Msg 4' },
            { role: 'user', content: 'Msg 5' },
        ];

        for (const msg of messages) {
            await conversationRepository.addMessage(conversation.id, msg);
        }

        // Get last 3 messages
        const recentMessages = await conversationRepository.getRecentMessages(conversation.id, 3);
        expect(recentMessages).toHaveLength(3);
        expect(recentMessages[0]?.content).toBe('Msg 3');
        expect(recentMessages[1]?.content).toBe('Msg 4');
        expect(recentMessages[2]?.content).toBe('Msg 5');

        // Get last 1 message
        const lastMessage = await conversationRepository.getRecentMessages(conversation.id, 1);
        expect(lastMessage).toHaveLength(1);
        expect(lastMessage[0]?.content).toBe('Msg 5');

        // Get 0 messages
        const noMessages = await conversationRepository.getRecentMessages(conversation.id, 0);
        expect(noMessages).toHaveLength(0);

        // Get more messages than exist
        const tooManyMessages = await conversationRepository.getRecentMessages(conversation.id, 10);
        expect(tooManyMessages).toHaveLength(5); // Should return all available
    });

    it('should handle invalid JSON in messages gracefully', async () => {
        const projectId = 'proj-msg-invalid';
        const conversationData: ConversationData = { title: 'Invalid Message Test', projectId };
        const conversation = await conversationRepository.create(conversationData);
        const messagesKey = `conv:${conversation.id}:messages`;

        const validMessage: Message = { role: 'user', content: 'Valid message' };
        const invalidJsonString = '{ "role": "user", "content": "Invalid JSON'; // Missing closing brace

        await conversationRepository.addMessage(conversation.id, validMessage);
        // Manually push invalid JSON string to simulate corruption
        await redis.rpush(messagesKey, invalidJsonString);

        // Spy on console.error to check if it's called
        const consoleErrorSpy = vi.spyOn(console, 'error');

        const messages = await conversationRepository.getMessages(conversation.id);

        // Should return only the valid message
        expect(messages).toHaveLength(1);
         expect(messages[0]?.content).toBe(validMessage.content);
         // Check that console.error was called for the invalid message
         expect(consoleErrorSpy).toHaveBeenCalledWith(
             expect.stringContaining(`Failed to process message item for conversation ${conversation.id}`),
             expect.stringContaining(invalidJsonString),
             expect.any(Error) // Expect a SyntaxError or similar
         );

        consoleErrorSpy.mockRestore(); // Clean up spy
    });


    // --- Post Relationship Tests ---

    it('should add, remove, and get post IDs for a conversation', async () => {
        const conversation = await conversationRepository.create({
            projectId: 'project-123',
            title: 'Test Conversation'
        });

        // Initially no posts
        expect(await conversationRepository.getPostIds(conversation.id)).toEqual([]);

        // Add posts
        const postId1 = 'post-1';
        const postId2 = 'post-2';
        await conversationRepository.addPost(conversation.id, postId1);
        await conversationRepository.addPost(conversation.id, postId2);
        
        let postIds = await conversationRepository.getPostIds(conversation.id);
        expect(postIds).toHaveLength(2);
        expect(postIds).toContain(postId1);
        expect(postIds).toContain(postId2);

        // Remove a post
        await conversationRepository.removePost(conversation.id, postId1);
        postIds = await conversationRepository.getPostIds(conversation.id);
        expect(postIds).toHaveLength(1);
        expect(postIds).toEqual([postId2]);

        // Remove the other post
        await conversationRepository.removePost(conversation.id, postId2);
        postIds = await conversationRepository.getPostIds(conversation.id);
        expect(postIds).toEqual([]);
    });
});