import 'dotenv/config'; // Load .env variables

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Redis } from '@upstash/redis';
import { RedisProjectRepository } from './redisProjectRepository';
import type { Project, ProjectData } from '../types';
import type { IProjectRepository } from '../interfaces';

// Basic check for environment variables
if (!process.env.TEST_UPSTASH_REDIS_REST_URL || !process.env.TEST_UPSTASH_REDIS_REST_TOKEN) {
    console.warn("Missing TEST Redis environment variables. Skipping integration tests.");
}

// Use describe.skipIf to conditionally skip tests if env vars are missing
const describeIf = (process.env.TEST_UPSTASH_REDIS_REST_URL && process.env.TEST_UPSTASH_REDIS_REST_TOKEN) ? describe : describe.skip;

describeIf('RedisProjectRepository Integration Tests', () => {
    let redis: Redis;
    let projectRepository: IProjectRepository; // Use interface type

    // Use test credentials safely
    const redisUrl = process.env.TEST_UPSTASH_REDIS_REST_URL!;
    const redisToken = process.env.TEST_UPSTASH_REDIS_REST_TOKEN!;

    beforeAll(() => {
        redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });
        projectRepository = new RedisProjectRepository(redis);
    });

    beforeEach(async () => {
        // Clean the database before each test
        await redis.flushdb();
    });

    it('should create a new project with full data and retrieve it by ID', async () => {
        const customerId = 'cust-123';
        const aiContextData = { targetAudience: 'developers', complexity: 'high' };
        const projectData: ProjectData = {
            name: 'Test Project Alpha',
            customerId: customerId,
            objective: 'Build the next big thing',
            aiContext: aiContextData,
        };

        const createdProject = await projectRepository.create(projectData);

        // Check the returned project object
        expect(createdProject).toBeDefined();
        expect(createdProject.id).toBeTypeOf('string');
        expect(createdProject.name).toBe(projectData.name);
        expect(createdProject.customerId).toBe(customerId);
        expect(createdProject.objective).toBe(projectData.objective);
        expect(createdProject.aiContext).toEqual(aiContextData);

        // Verify by fetching from Redis
        const retrievedProject = await projectRepository.getById(createdProject.id);
        expect(retrievedProject).not.toBeNull();
        expect(retrievedProject).toEqual(createdProject);

        // Verify AI context separately if needed (already checked by toEqual)
        expect(retrievedProject?.aiContext).toEqual(aiContextData);
    });

     it('should create a project with minimal data', async () => {
        const customerId = 'cust-456';
         const projectData: ProjectData = {
            name: 'Minimal Project Beta',
            customerId: customerId,
        };

        const createdProject = await projectRepository.create(projectData);

        expect(createdProject).toBeDefined();
        expect(createdProject.id).toBeTypeOf('string');
        expect(createdProject.name).toBe(projectData.name);
        expect(createdProject.customerId).toBe(customerId);
        expect(createdProject.objective).toBeUndefined();
        expect(createdProject.aiContext).toBeUndefined();

        const retrievedProject = await projectRepository.getById(createdProject.id);
        expect(retrievedProject).not.toBeNull();
        expect(retrievedProject).toEqual(createdProject); // Checks undefined fields match
     });


    it('should return null when getting a project by non-existent ID', async () => {
        const nonExistentId = 'non-existent-proj-id-98765';
        const retrievedProject = await projectRepository.getById(nonExistentId);
        expect(retrievedProject).toBeNull();
    });

    it('should update a project using the general update method', async () => {
        const customerId = 'cust-upd-gen';
        const initialData: ProjectData = { name: 'Before General Update', customerId: customerId, objective: 'Initial Objective' };
        const project = await projectRepository.create(initialData);

        const updates: Partial<ProjectData> = {
            name: 'After General Update',
            objective: 'Updated Objective',
            aiContext: { status: 'in-progress' }
        };
        const updatedProject = await projectRepository.update(project.id, updates);

        // Check returned value from update
        expect(updatedProject.name).toBe(updates.name);
        expect(updatedProject.objective).toBe(updates.objective);
        expect(updatedProject.aiContext).toEqual(updates.aiContext);
        expect(updatedProject.customerId).toBe(customerId); // Ensure customerId wasn't changed

        // Verify by fetching
        const fetchedProject = await projectRepository.getById(project.id);
        expect(fetchedProject).toEqual(updatedProject);
    });


    it('should update basic info (name, objective) using updateBasicInfo', async () => {
        const customerId = 'cust-upd-basic';
        const initialData: ProjectData = { name: 'Before Basic Update', customerId: customerId, objective: 'Old Objective', aiContext: { initial: true } };
        const project = await projectRepository.create(initialData);

        const updates = { name: 'After Basic Update', objective: 'New Objective' };
        await projectRepository.updateBasicInfo(project.id, updates);

        const updatedProject = await projectRepository.getById(project.id);
        expect(updatedProject?.name).toBe(updates.name);
        expect(updatedProject?.objective).toBe(updates.objective);
        expect(updatedProject?.customerId).toBe(customerId); // Ensure customerId wasn't changed
        expect(updatedProject?.aiContext).toEqual({ initial: true }); // Ensure aiContext wasn't changed
    });

    it('should update and get AI context', async () => {
        const customerId = 'cust-ctx';
        const initialData: ProjectData = { name: 'AI Context Project', customerId: customerId };
        const project = await projectRepository.create(initialData);

        // Test getting initially undefined context
        let retrievedContext = await projectRepository.getAiContext(project.id);
        expect(retrievedContext).toBeNull(); // getAiContext returns null if not set or parse error

        // Test updating context
        const newContext = { primaryGoal: 'testing', secondaryGoal: 'more testing' };
        await projectRepository.updateAiContext(project.id, newContext);

        // Test getting updated context
        retrievedContext = await projectRepository.getAiContext(project.id);
        expect(retrievedContext).toEqual(newContext);

        // Verify getById also returns updated context
        const updatedProject = await projectRepository.getById(project.id);
        expect(updatedProject?.aiContext).toEqual(newContext);
    });

    it('should set a new customer and get the customer ID', async () => {
        const customerA = 'cust-A';
        const customerB = 'cust-B';
        const initialData: ProjectData = { name: 'Customer Change Project', customerId: customerA };
        const project = await projectRepository.create(initialData);

        // Verify initial state
        expect(await projectRepository.getCustomerId(project.id)).toBe(customerA);

        // Set new customer
        await projectRepository.setCustomer(project.id, customerB);

        // Verify new state
        expect(await projectRepository.getCustomerId(project.id)).toBe(customerB);
        const updatedProject = await projectRepository.getById(project.id);
        expect(updatedProject?.customerId).toBe(customerB);
    });

    it('should add, remove, and get conversation IDs', async () => {
        const customerId = 'cust-conv';
        const initialData: ProjectData = { name: 'Conversation Links Project', customerId: customerId };
        const project = await projectRepository.create(initialData);
        const convoId1 = 'convo-1';
        const convoId2 = 'convo-2';

        // Initial state
        expect(await projectRepository.getConversationIds(project.id)).toEqual([]);

        // Add conversations
        await projectRepository.addConversation(project.id, convoId1);
        await projectRepository.addConversation(project.id, convoId2);
        let conversationIds = await projectRepository.getConversationIds(project.id);
        // Order isn't guaranteed in sets, so check for presence and length
        expect(conversationIds).toHaveLength(2);
        expect(conversationIds).toContain(convoId1);
        expect(conversationIds).toContain(convoId2);

        // Remove a conversation
        await projectRepository.removeConversation(project.id, convoId1);
        conversationIds = await projectRepository.getConversationIds(project.id);
        expect(conversationIds).toHaveLength(1);
        expect(conversationIds).toEqual([convoId2]); // Only convo-2 should remain

        // Remove the other conversation
        await projectRepository.removeConversation(project.id, convoId2);
        conversationIds = await projectRepository.getConversationIds(project.id);
        expect(conversationIds).toEqual([]);
    });
});