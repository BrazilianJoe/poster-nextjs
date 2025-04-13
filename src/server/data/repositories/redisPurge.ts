import { Redis } from '@upstash/redis';
import { RedisKeys } from './redisKeys';

export class RedisPurge {
    private redis: Redis;
    private keys: RedisKeys;

    constructor(redisClient: Redis) {
        this.redis = redisClient;
        this.keys = new RedisKeys();
    }

    async purgeTestData(): Promise<void> {
        console.log('Cleaning up all test data...');
        
        // Get all keys
        const allKeys = await this.redis.keys('*');
        console.log(`Found ${allKeys.length} keys to check`);

        // Filter keys that are part of test data
        const testKeys = allKeys.filter(key => 
            key.startsWith('test::') || 
            key.startsWith('test:') ||
            // Also include users and subscriptions that might be test data
            (key.startsWith('user:') && !key.includes(':email')) ||
            key.startsWith('sub:')
        );

        console.log(`Found ${testKeys.length} test keys to purge`);
        
        // Delete each key
        for (const key of testKeys) {
            console.log(`Purging test key: ${key}`);
            await this.redis.del(key);
        }

        console.log('Test data purge complete');
    }

    isTestKey(key: string): boolean {
        return key.startsWith('test::') || key.startsWith('test:');
    }
} 