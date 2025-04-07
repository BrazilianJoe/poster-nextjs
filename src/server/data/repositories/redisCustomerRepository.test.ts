import 'dotenv/config'; // Load .env variables

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Redis } from '@upstash/redis';
import { RedisCustomerRepository } from './redisCustomerRepository';
import type { Customer, CustomerData, UserRole } from '../types';
import type { ICustomerRepository } from '../interfaces';

// Basic check for environment variables
if (!process.env.TEST_UPSTASH_REDIS_REST_URL || !process.env.TEST_UPSTASH_REDIS_REST_TOKEN) {
    console.warn("Missing TEST Redis environment variables. Skipping integration tests.");
}

// Use describe.skipIf to conditionally skip tests if env vars are missing
const describeIf = (process.env.TEST_UPSTASH_REDIS_REST_URL && process.env.TEST_UPSTASH_REDIS_REST_TOKEN) ? describe : describe.skip;

describeIf('RedisCustomerRepository Integration Tests', () => {
    let redis: Redis;
    let customerRepository: ICustomerRepository; // Use interface type

    // Use test credentials safely
    const redisUrl = process.env.TEST_UPSTASH_REDIS_REST_URL!;
    const redisToken = process.env.TEST_UPSTASH_REDIS_REST_TOKEN!;

    beforeAll(() => {
        redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });
        customerRepository = new RedisCustomerRepository(redis);
    });

    beforeEach(async () => {
        // Clean the database before each test
        await redis.flushdb();
    });

    it('should create a new customer and retrieve it by ID', async () => {
        const ownerId = 'user-owner-123';
        const aiContextData = { tone: 'professional', keywords: ['SaaS', 'B2B'] };
        const customerData: CustomerData = {
            name: 'Test Customer Inc.',
            ownerUserId: ownerId,
            industry: 'Software',
            aiContext: aiContextData,
        };

        const createdCustomer = await customerRepository.create(customerData);

        // Check the returned customer object
        expect(createdCustomer).toBeDefined();
        expect(createdCustomer.id).toBeTypeOf('string');
        expect(createdCustomer.name).toBe(customerData.name);
        expect(createdCustomer.ownerUserId).toBe(ownerId);
        expect(createdCustomer.industry).toBe(customerData.industry);
        expect(createdCustomer.aiContext).toEqual(aiContextData);

        // Verify by fetching from Redis
        const retrievedCustomer = await customerRepository.getById(createdCustomer.id);
        expect(retrievedCustomer).not.toBeNull();
        expect(retrievedCustomer).toEqual(createdCustomer);

        // Verify AI context separately if needed (already checked by toEqual)
        expect(retrievedCustomer?.aiContext).toEqual(aiContextData);

        // Verify owner permission was set
        const ownerPermission = await customerRepository.getPermissionForUser(createdCustomer.id, ownerId);
        expect(ownerPermission).toBe('owner');
    });

     it('should create a customer with minimal data', async () => {
        const ownerId = 'user-owner-456';
         const customerData: CustomerData = {
            name: 'Minimal Customer LLC',
            ownerUserId: ownerId,
        };

        const createdCustomer = await customerRepository.create(customerData);

        expect(createdCustomer).toBeDefined();
        expect(createdCustomer.id).toBeTypeOf('string');
        expect(createdCustomer.name).toBe(customerData.name);
        expect(createdCustomer.ownerUserId).toBe(ownerId);
        // Check optional fields based on your type definition (might be undefined or null)
        expect(createdCustomer.industry).toBeUndefined();
        expect(createdCustomer.aiContext).toBeUndefined();

        const retrievedCustomer = await customerRepository.getById(createdCustomer.id);
        expect(retrievedCustomer).not.toBeNull();
        expect(retrievedCustomer).toEqual(createdCustomer); // Checks undefined fields match

        // Verify owner permission was set
        const ownerPermission = await customerRepository.getPermissionForUser(createdCustomer.id, ownerId);
        expect(ownerPermission).toBe('owner');
     });


    it('should return null when getting a customer by non-existent ID', async () => {
        const nonExistentId = 'non-existent-cust-id-67890';
        const retrievedCustomer = await customerRepository.getById(nonExistentId);
        expect(retrievedCustomer).toBeNull();
    });

    it('should update basic info (name, industry)', async () => {
        const ownerId = 'user-owner-upd';
        const initialData: CustomerData = { name: 'Before Update', ownerUserId: ownerId, industry: 'Old Industry' };
        const customer = await customerRepository.create(initialData);

        const updates = { name: 'After Update', industry: 'New Industry' };
        await customerRepository.updateBasicInfo(customer.id, updates);

        const updatedCustomer = await customerRepository.getById(customer.id);
        expect(updatedCustomer?.name).toBe(updates.name);
        expect(updatedCustomer?.industry).toBe(updates.industry);
        expect(updatedCustomer?.ownerUserId).toBe(ownerId); // Ensure owner wasn't changed
    });

    it('should update and get AI context', async () => {
        const ownerId = 'user-owner-ctx';
        const initialData: CustomerData = { name: 'AI Context Test', ownerUserId: ownerId };
        const customer = await customerRepository.create(initialData);

        // Test getting initially undefined context
        let retrievedContext = await customerRepository.getAiContext(customer.id);
        expect(retrievedContext).toBeNull(); // getAiContext returns null if not set or parse error

        // Test updating context
        const newContext = { goal: 'increase engagement', style: 'informal' };
        await customerRepository.updateAiContext(customer.id, newContext);

        // Test getting updated context
        retrievedContext = await customerRepository.getAiContext(customer.id);
        expect(retrievedContext).toEqual(newContext);

        // Verify getById also returns updated context
        const updatedCustomer = await customerRepository.getById(customer.id);
        expect(updatedCustomer?.aiContext).toEqual(newContext);
    });

    it('should set a new owner and update permissions', async () => {
        const ownerA = 'user-owner-A';
        const ownerB = 'user-owner-B';
        const initialData: CustomerData = { name: 'Ownership Transfer', ownerUserId: ownerA };
        const customer = await customerRepository.create(initialData);

        // Verify initial state
        expect(await customerRepository.getOwnerUserId(customer.id)).toBe(ownerA);
        expect(await customerRepository.getPermissionForUser(customer.id, ownerA)).toBe('owner');
        expect(await customerRepository.getPermissionForUser(customer.id, ownerB)).toBeNull();

        // Set new owner
        await customerRepository.setOwner(customer.id, ownerB);

        // Verify new state
        expect(await customerRepository.getOwnerUserId(customer.id)).toBe(ownerB);
        expect(await customerRepository.getPermissionForUser(customer.id, ownerB)).toBe('owner');
        // Check if old owner permission was removed (based on current implementation)
        expect(await customerRepository.getPermissionForUser(customer.id, ownerA)).toBeNull();
    });

    it('should add, remove, and get project IDs', async () => {
        const ownerId = 'user-owner-proj';
        const initialData: CustomerData = { name: 'Project Links Test', ownerUserId: ownerId };
        const customer = await customerRepository.create(initialData);
        const projectId1 = 'proj-1';
        const projectId2 = 'proj-2';

        // Initial state
        expect(await customerRepository.getProjectIds(customer.id)).toEqual([]);

        // Add projects
        await customerRepository.addProject(customer.id, projectId1);
        await customerRepository.addProject(customer.id, projectId2);
        let projectIds = await customerRepository.getProjectIds(customer.id);
        // Order isn't guaranteed in sets, so check for presence and length
        expect(projectIds).toHaveLength(2);
        expect(projectIds).toContain(projectId1);
        expect(projectIds).toContain(projectId2);

        // Remove a project
        await customerRepository.removeProject(customer.id, projectId1);
        projectIds = await customerRepository.getProjectIds(customer.id);
        expect(projectIds).toHaveLength(1);
        expect(projectIds).toEqual([projectId2]); // Only proj-2 should remain

        // Remove the other project
        await customerRepository.removeProject(customer.id, projectId2);
        projectIds = await customerRepository.getProjectIds(customer.id);
        expect(projectIds).toEqual([]);
    });

    it('should set, get, and remove permissions', async () => {
        const ownerId = 'user-owner-perm';
        const adminId = 'user-admin-perm';
        const editorId = 'user-editor-perm';
        const initialData: CustomerData = { name: 'Permissions Test', ownerUserId: ownerId };
        const customer = await customerRepository.create(initialData);

        // Set permissions
        await customerRepository.setPermission(customer.id, adminId, 'admin');
        await customerRepository.setPermission(customer.id, editorId, 'editor');

        // Get specific permissions
        expect(await customerRepository.getPermissionForUser(customer.id, ownerId)).toBe('owner');
        expect(await customerRepository.getPermissionForUser(customer.id, adminId)).toBe('admin');
        expect(await customerRepository.getPermissionForUser(customer.id, editorId)).toBe('editor');
        expect(await customerRepository.getPermissionForUser(customer.id, 'non-existent-user')).toBeNull();

        // Get all permissions
        const allPermissions = await customerRepository.getPermissions(customer.id);
        expect(allPermissions).toEqual({
            [ownerId]: 'owner',
            [adminId]: 'admin',
            [editorId]: 'editor',
        });

        // Remove a permission
        await customerRepository.removePermission(customer.id, editorId);
        expect(await customerRepository.getPermissionForUser(customer.id, editorId)).toBeNull();
        const permissionsAfterRemove = await customerRepository.getPermissions(customer.id);
        expect(permissionsAfterRemove).toEqual({
            [ownerId]: 'owner',
            [adminId]: 'admin',
        });

        // Attempt to remove owner (should be ignored based on implementation)
        await customerRepository.removePermission(customer.id, ownerId);
        expect(await customerRepository.getPermissionForUser(customer.id, ownerId)).toBe('owner'); // Should still be owner
    });
});