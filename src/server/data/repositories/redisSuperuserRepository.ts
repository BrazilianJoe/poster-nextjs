import { Redis } from '@upstash/redis';
import type { ISuperuserRepository } from '../interfaces';

export class RedisSuperuserRepository implements ISuperuserRepository {
    private redis: Redis;
    private readonly superuserSetKey = 'superusers'; // Define the key for the Set

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    async isSuperuser(userId: string): Promise<boolean> {
        // SISMEMBER returns 1 if member exists, 0 otherwise.
        const result = await this.redis.sismember(this.superuserSetKey, userId);
        return result === 1;
    }

    async addSuperuser(userId: string): Promise<void> {
        // SADD adds the member to the set. Returns number of elements added (0 if already exists).
        // We don't need the return value here.
        await this.redis.sadd(this.superuserSetKey, userId);
    }

    async removeSuperuser(userId: string): Promise<void> {
        // SREM removes the member from the set. Returns number of elements removed.
        // We don't need the return value here.
        await this.redis.srem(this.superuserSetKey, userId);
    }
}