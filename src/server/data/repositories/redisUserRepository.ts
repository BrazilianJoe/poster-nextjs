import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid'; // Assuming uuid is installed
import type { IUserRepository } from '../interfaces';
import type { User, UserData } from '../types';

// Helper function to filter out null/undefined values for HSET
function cleanHashData(data: Record<string, any>): Record<string, any> {
    return Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined)
        .reduce((obj, [key, value]) => {
            // Ensure values are strings or numbers for Redis hash compatibility if needed,
            // but Upstash client might handle basic types. Let's assume string conversion for safety.
            obj[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return obj;
        }, {} as Record<string, any>);
}


export class RedisUserRepository implements IUserRepository {
    private redis: Redis;
    private keyPrefix = 'user:';
    private emailIndexPrefix = 'user_email:'; // For findByEmail lookup

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    private getKey(userId: string): string {
        return `${this.keyPrefix}${userId}`;
    }

    private getEmailIndexKey(email: string): string {
        // Normalize email for consistent indexing (e.g., lowercase)
        return `${this.emailIndexPrefix}${email.toLowerCase()}`;
    }

    async upsert(data: UserData, mode?: 'create' | 'update'): Promise<User> {
        const emailIndexKey = this.getEmailIndexKey(data.email);
        const existingUserId = await this.redis.get(emailIndexKey);

        if (mode === 'create' && existingUserId) {
            throw new Error(`User with email ${data.email} already exists.`);
        }

        if (mode === 'update' && !existingUserId) {
            throw new Error(`User with email ${data.email} does not exist.`);
        }

        // Ensure userId is explicitly a string
        const userId: string = typeof existingUserId === 'string' ? existingUserId : uuidv4();
        const key = this.getKey(userId);

        // Prepare data for hset
        const userDataForHash = {
            name: data.name,
            email: data.email,
            subscriptionId: data.subscriptionId ?? null,
        };

        await this.redis.hset(key, userDataForHash);
        // Consider potential failure setting index? For now, proceed.
        await this.redis.set(emailIndexKey, userId);

        // Construct and return the correct User type
        const returnUser: User = {
            id: userId, // Now guaranteed to be string
            name: data.name,
            email: data.email,
            subscriptionId: data.subscriptionId ?? null
        };
        return returnUser;
    }

    async create(data: UserData): Promise<User> {
        return this.upsert(data, 'create');
    }

    async getById(userId: string): Promise<User | null> {
        const key = this.getKey(userId);
        console.log(`Retrieving data for key: ${key}`);
        const data = await this.redis.hgetall(key);
        // console.log(`Retrieved data:`, data); // Remove debug log

        if (!data) {
            return null; // Key doesn't exist
        }
        // Validate essential fields retrieved from hash
        if (typeof data.email !== 'string' || typeof data.name !== 'string') {
             console.error(`Incomplete or invalid user data found for key: ${key}`, data);
             return null; // Data integrity issue
        }

        // Construct and return the correct User type
        return {
            id: userId,
            email: data.email, // Already validated as string
            name: data.name,   // Already validated as string
            subscriptionId: typeof data.subscriptionId === 'string' ? data.subscriptionId : null, // Ensure correct type or null
        };
    }

    async findByEmail(email: string): Promise<User | null> {
        const emailIndexKey = this.getEmailIndexKey(email);
        console.log(`Looking up email index key: ${emailIndexKey}`);
        const userId = await this.redis.get<string>(emailIndexKey);
        console.log(`Retrieved user ID for email: ${userId}`);
        if (!userId) {
            return null;
        }
        return this.getById(userId);
    }

    async update(userId: string, data: Partial<UserData>): Promise<void> {
        const currentUser = await this.getById(userId);
        if (!currentUser) {
            throw new Error(`User with ID ${userId} not found for update.`);
        }

        const updateData: Record<string, string | number | boolean> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.subscriptionId !== undefined && data.subscriptionId !== null) {
            updateData.subscriptionId = data.subscriptionId;
        }

        const pipe = this.redis.pipeline();
        if (Object.keys(updateData).length > 0) {
            pipe.hset(this.getKey(userId), updateData);
        }

        if (data.email && data.email.toLowerCase() !== currentUser.email.toLowerCase()) {
            const newEmailIndexKey = this.getEmailIndexKey(data.email);
            const existingUserCheck = await this.redis.get(newEmailIndexKey);
            if (existingUserCheck && existingUserCheck !== userId) {
                throw new Error(`Email ${data.email} is already in use by another user.`);
            }
            const oldEmailIndexKey = this.getEmailIndexKey(currentUser.email);
            pipe.del(oldEmailIndexKey);
            pipe.set(newEmailIndexKey, userId);
        }

        if (data.subscriptionId === null) {
            pipe.hdel(this.getKey(userId), 'subscriptionId');
        }

        await pipe.exec();
    }

    async setSubscriptionId(userId: string, subscriptionId: string | null): Promise<void> {
        const key = this.getKey(userId);
        if (subscriptionId === null) {
            await this.redis.hdel(key, 'subscriptionId');
        } else {
            await this.redis.hset(key, { subscriptionId });
        }
    }

    async delete(userId: string): Promise<void> {
        const user = await this.getById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }

        const key = this.getKey(userId);
        const emailIndexKey = this.getEmailIndexKey(user.email);

        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();

        // Delete main user data
        pipe.del(key);

        // Delete email index
        pipe.del(emailIndexKey);

        // Execute all operations atomically
        await pipe.exec();

        // Note: The service layer should handle:
        // 1. Updating any subscriptions associated with this user
        // 2. Any other cleanup needed
    }
}