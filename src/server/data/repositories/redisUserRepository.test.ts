import 'dotenv/config'; // Load .env variables

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Redis } from '@upstash/redis';
import { RedisUserRepository } from './redisUserRepository';
import type { User, UserData } from '../types';
import type { IUserRepository } from '../interfaces'; // Import interface for type safety

// Basic check for environment variables
if (!process.env.TEST_UPSTASH_REDIS_REST_URL || !process.env.TEST_UPSTASH_REDIS_REST_TOKEN) {
    console.warn("Missing TEST Redis environment variables. Skipping integration tests.");
    // Vitest doesn't have a global skip like Jest, so tests might fail if connection fails.
    // Alternatively, throw an error to halt testing.
    // throw new Error("Missing TEST Redis environment variables");
}

// Use describe.skipIf to conditionally skip tests if env vars are missing
const describeIf = (process.env.TEST_UPSTASH_REDIS_REST_URL && process.env.TEST_UPSTASH_REDIS_REST_TOKEN) ? describe : describe.skip;

describeIf('RedisUserRepository Integration Tests', () => {
    let redis: Redis;
    let userRepository: IUserRepository; // Use interface type

    // Use test credentials safely
    const redisUrl = process.env.TEST_UPSTASH_REDIS_REST_URL!;
    const redisToken = process.env.TEST_UPSTASH_REDIS_REST_TOKEN!;

    beforeAll(() => {
        // Initialize Redis client only if variables are present
        redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });
        userRepository = new RedisUserRepository(redis);
    });

    beforeEach(async () => {
        // Clean the database before each test
        await redis.flushdb();
    });

    // Optional: afterEach or afterAll could be used for cleanup if needed,
    // but flushdb in beforeEach is usually sufficient.

    it('should create a new user and retrieve it by ID', async () => {
        const userData: UserData = {
            email: 'test@example.com',
            name: 'Test User',
            subscriptionId: 'sub-123',
        };

        const createdUser = await userRepository.create(userData);

        // Check the returned user object
        expect(createdUser).toBeDefined();
        expect(createdUser.id).toBeTypeOf('string');
        expect(createdUser.email).toBe(userData.email);
        expect(createdUser.name).toBe(userData.name);
        expect(createdUser.subscriptionId).toBe(userData.subscriptionId);

        // Verify by fetching from Redis
        const retrievedUser = await userRepository.getById(createdUser.id);
        expect(retrievedUser).not.toBeNull();
        // Use toEqual for deep equality comparison of objects
        expect(retrievedUser).toEqual(createdUser);
    });

     it('should return null when getting a user by non-existent ID', async () => {
        const nonExistentId = 'non-existent-id-12345';
        const retrievedUser = await userRepository.getById(nonExistentId);
        expect(retrievedUser).toBeNull();
    });

     it('should create a user without a subscriptionId', async () => {
        const userData: UserData = {
            email: 'nosub@example.com',
            name: 'No Sub User',
        };

        const createdUser = await userRepository.create(userData);

        expect(createdUser).toBeDefined();
        expect(createdUser.id).toBeTypeOf('string');
        expect(createdUser.email).toBe(userData.email);
        expect(createdUser.name).toBe(userData.name);
        expect(createdUser.subscriptionId).toBeNull(); // Implementation should ensure null

        const retrievedUser = await userRepository.getById(createdUser.id);
        expect(retrievedUser).not.toBeNull();
        expect(retrievedUser?.subscriptionId).toBeNull();
        expect(retrievedUser).toEqual(createdUser);
    });

    it('should find a user by email', async () => {
        const userData: UserData = {
            email: 'findme@example.com',
            name: 'Findable User',
        };
        const createdUser = await userRepository.create(userData);

        const foundUser = await userRepository.findByEmail(userData.email);
        expect(foundUser).not.toBeNull();
        expect(foundUser).toEqual(createdUser);
    });

    it('should return null when finding user by non-existent email', async () => {
        const foundUser = await userRepository.findByEmail('nosuchuser@example.com');
        expect(foundUser).toBeNull();
    });

    it('should update user name', async () => {
        const userData: UserData = { email: 'update@example.com', name: 'Original Name' };
        const createdUser = await userRepository.create(userData);
        const newName = 'Updated Name';

        await userRepository.update(createdUser.id, { name: newName });

        const updatedUser = await userRepository.getById(createdUser.id);
        expect(updatedUser).not.toBeNull();
        expect(updatedUser?.name).toBe(newName);
        expect(updatedUser?.email).toBe(userData.email); // Email should be unchanged
    });

     it('should update user email and email index', async () => {
        const originalEmail = 'change.email@example.com';
        const newEmail = 'new.email@example.com';
        const userData: UserData = { email: originalEmail, name: 'Email Changer' };
        const createdUser = await userRepository.create(userData);

        await userRepository.update(createdUser.id, { email: newEmail });

        // Verify user data
        const updatedUser = await userRepository.getById(createdUser.id);
        expect(updatedUser).not.toBeNull();
        expect(updatedUser?.email).toBe(newEmail);

        // Verify findByEmail works with new email
        const foundByNewEmail = await userRepository.findByEmail(newEmail);
        expect(foundByNewEmail).not.toBeNull();
        expect(foundByNewEmail?.id).toBe(createdUser.id);

        // Verify findByEmail fails with old email
        const foundByOldEmail = await userRepository.findByEmail(originalEmail);
        expect(foundByOldEmail).toBeNull();

        // Verify Redis index keys directly (optional but good for confidence)
        const oldIndexKey = `user_email:${originalEmail.toLowerCase()}`;
        const newIndexKey = `user_email:${newEmail.toLowerCase()}`;
        expect(await redis.exists(oldIndexKey)).toBe(0);
        expect(await redis.get(newIndexKey)).toBe(createdUser.id);
    });

     it('should update subscriptionId using update method', async () => {
        const userData: UserData = { email: 'sub.update@example.com', name: 'Sub Updater' };
        const createdUser = await userRepository.create(userData);
        const newSubId = 'sub-updated-456';

        await userRepository.update(createdUser.id, { subscriptionId: newSubId });
        const updatedUser = await userRepository.getById(createdUser.id);
        expect(updatedUser?.subscriptionId).toBe(newSubId);

        // Test setting to null via update
        await userRepository.update(createdUser.id, { subscriptionId: null });
        const updatedUserNullSub = await userRepository.getById(createdUser.id);
        expect(updatedUserNullSub?.subscriptionId).toBeNull();
     });


    it('should set and remove subscriptionId using setSubscriptionId method', async () => {
        const userData: UserData = { email: 'setsub@example.com', name: 'Set Sub User' };
        const createdUser = await userRepository.create(userData);
        const subId = 'sub-789';

        // Set subscriptionId
        await userRepository.setSubscriptionId(createdUser.id, subId);
        let retrievedUser = await userRepository.getById(createdUser.id);
        expect(retrievedUser).not.toBeNull();
        expect(retrievedUser?.subscriptionId).toBe(subId);

        // Remove subscriptionId (set to null)
        await userRepository.setSubscriptionId(createdUser.id, null);
        retrievedUser = await userRepository.getById(createdUser.id);
        expect(retrievedUser).not.toBeNull();
        expect(retrievedUser?.subscriptionId).toBeNull();
    });

    it('should throw an error when creating a user with a duplicate email', async () => {
        const userData: UserData = { email: 'duplicate@example.com', name: 'First User' };
        await userRepository.create(userData); // Create the first user

        const duplicateUserData: UserData = { email: 'duplicate@example.com', name: 'Second User' };

        // Expect the second create call to reject with an error
        await expect(userRepository.create(duplicateUserData))
            .rejects
            .toThrow(`User with email ${userData.email} already exists.`);
    });

     it('should throw an error when updating email to an existing email', async () => {
        const email1 = 'exist1@example.com';
        const email2 = 'exist2@example.com';
        const user1 = await userRepository.create({ email: email1, name: 'User One'});
        const user2 = await userRepository.create({ email: email2, name: 'User Two'});

        // Try to update user2's email to user1's email
         await expect(userRepository.update(user2.id, { email: email1 }))
            .rejects
            .toThrow(`Email ${email1} is already in use by another user.`);
     });
});