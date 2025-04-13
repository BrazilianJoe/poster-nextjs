import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { ISubscriptionRepository } from '../interfaces';
import type { Subscription, SubscriptionData } from '../types';

export class RedisSubscriptionRepository implements ISubscriptionRepository {
    private redis: Redis;
    private keyPrefix = 'sub:';
    private userIndexPrefix = 'sub_user:'; // Index: userId -> subscriptionId

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    // --- Key Generation ---
    private getMainKey(subscriptionId: string): string {
        return `${this.keyPrefix}${subscriptionId}`;
    }
    private getUserIndexKey(userId: string): string {
        return `${this.userIndexPrefix}${userId}`;
    }

    // --- Core CRUD ---
    async create(data: SubscriptionData): Promise<Subscription> {
        const subscriptionId = uuidv4();
        const mainKey = this.getMainKey(subscriptionId);
        const userIndexKey = this.getUserIndexKey(data.userId);

        // Check if user already has a subscription via the index
        const existingSubId = await this.redis.get(userIndexKey);
        if (existingSubId) {
            // Enforce one subscription per user rule
            throw new Error(`User ${data.userId} already has an active subscription (ID: ${existingSubId}).`);
        }

        const subscriptionDataForHash: Record<string, string | number | boolean> = {
            userId: data.userId,
            planType: data.planType,
            status: data.status,
            // Add other relevant fields like start/end dates if needed in data
        };

        // Use pipeline for atomicity: create sub hash and user index
        const pipe = this.redis.pipeline();
        pipe.hset(mainKey, subscriptionDataForHash);
        // Set with expiration? Maybe not for this index.
        pipe.set(userIndexKey, subscriptionId); // Create userId -> subscriptionId index
        await pipe.exec();

        // Note: Updating the user's subscriptionId field (user:<id>)
        // should be handled by the service layer coordinating with IUserRepository.

        const newSubscription: Subscription = {
            id: subscriptionId,
            ...data, // Spread original data
        };
        return newSubscription;
    }

    async getById(subscriptionId: string): Promise<Subscription | null> {
        const mainKey = this.getMainKey(subscriptionId);
        const data = await this.redis.hgetall(mainKey);

        if (!data) {
            return null; // Key doesn't exist
        }

        // Validate essential fields
        if (typeof data.userId !== 'string' || typeof data.planType !== 'string' || typeof data.status !== 'string') {
            console.error(`Incomplete or invalid subscription data found for key: ${mainKey}`, data);
            return null;
        }

        return {
            id: subscriptionId,
            userId: data.userId,
            planType: data.planType,
            status: data.status,
        };
    }

    async findByUserId(userId: string): Promise<Subscription | null> {
        const userIndexKey = this.getUserIndexKey(userId);
        const subscriptionId = await this.redis.get<string>(userIndexKey); // Specify type

        if (!subscriptionId) {
            return null; // No subscription found for this user
        }

        // Fetch the full subscription data using the found ID
        return this.getById(subscriptionId);
    }

    async update(subscriptionId: string, data: Partial<SubscriptionData>): Promise<void> {
        const mainKey = this.getMainKey(subscriptionId);
        // Exclude userId from direct updates via this method
        const { userId, ...updateDataRest } = data;

        if (userId !== undefined) {
             console.warn(`Attempted to update userId for subscription ${subscriptionId}. This is generally not allowed.`);
             // Decide: throw error or ignore userId field? Ignoring for now.
        }


        const updatePayload: Record<string, string> = {};
        if (updateDataRest.planType !== undefined) updatePayload.planType = updateDataRest.planType;
        if (updateDataRest.status !== undefined) updatePayload.status = updateDataRest.status;
        // Add other updatable fields here (e.g., endDate)

        if (Object.keys(updatePayload).length > 0) {
            // Optional: Check if subscription exists first
            // const exists = await this.redis.exists(mainKey);
            // if (!exists) throw new Error(`Subscription ${subscriptionId} not found.`);
            await this.redis.hset(mainKey, updatePayload);
        }
    }

    async setUserId(subscriptionId: string, userId: string | null): Promise<void> {
        const mainKey = this.getMainKey(subscriptionId);
        if (userId === null) {
            await this.redis.hdel(mainKey, 'userId');
        } else {
            await this.redis.hset(mainKey, { userId });
        }
    }

    async delete(subscriptionId: string): Promise<void> {
        const subscription = await this.getById(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription with ID ${subscriptionId} not found.`);
        }

        const mainKey = this.getMainKey(subscriptionId);
        const userIndexKey = this.getUserIndexKey(subscription.userId);

        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();

        // Delete main subscription data
        pipe.del(mainKey);

        // Delete user index
        pipe.del(userIndexKey);

        // Execute all operations atomically
        await pipe.exec();

        // Note: The service layer should handle:
        // 1. Updating the user's subscriptionId field
        // 2. Any other cleanup needed
    }
}