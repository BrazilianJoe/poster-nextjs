import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { ICustomerRepository } from '../interfaces';
import type { Customer, CustomerData, CustomerAccess, UserRole } from '../types';
import { RedisKeys } from './redisKeys';

// Role priority for sorted set scores
const ROLE_PRIORITY = {
    owner: 4,
    admin: 3,
    editor: 2,
    viewer: 1
} as const;

// Helper function (consider moving to a shared utils file)
// Ensures values are suitable for Redis hash (strings, numbers, booleans)
function cleanHashData(data: Record<string, any>): Record<string, string | number | boolean> {
    const cleaned: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            // Simple conversion for hset compatibility
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                 cleaned[key] = value;
            } else {
                 // Stringify objects/arrays, handle others as needed
                 cleaned[key] = JSON.stringify(value);
            }
        }
    }
    return cleaned;
}

export class RedisCustomerRepository implements ICustomerRepository {
    private redis: Redis;
    private keys: RedisKeys;

    constructor(redis: Redis) {
        this.redis = redis;
        this.keys = new RedisKeys();
    }

    async create(data: CustomerData): Promise<Customer> {
        const customerId = uuidv4();
        const mainKey = this.keys.customer(customerId);
        const permissionsKey = this.keys.customerPermissions(customerId);
        const userCustomersKey = this.keys.userCustomers(data.ownerUserId);

        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();
        
        // Set main customer data
        pipe.hset(mainKey, {
            name: data.name,
            ownerUserId: data.ownerUserId,
            industry: data.industry || '',
            aiContext_json: data.aiContext ? JSON.stringify(data.aiContext) : ''
        });

        // Set owner permission
        pipe.hset(permissionsKey, { [data.ownerUserId]: 'owner' });
        
        // Add to user's customer set with owner priority
        pipe.zadd(userCustomersKey, { score: ROLE_PRIORITY.owner, member: customerId });

        await pipe.exec();

        return {
            id: customerId,
            ...data,
            permissions: { [data.ownerUserId]: 'owner' }
        };
    }

    async getById(customerId: string): Promise<Customer | null> {
        const mainKey = this.keys.customer(customerId);
        const data = await this.redis.hgetall<{
            name: string;
            ownerUserId: string;
            industry: string;
            aiContext_json: string | Record<string, any>;
        }>(mainKey);

        if (!data) return null;

        const permissions = await this.getPermissions(customerId);

        // Parse AI context safely
        let aiContext: Record<string, any> | undefined;
        try {
            if (data.aiContext_json) {
                if (typeof data.aiContext_json === 'string') {
                    aiContext = JSON.parse(data.aiContext_json);
                } else if (typeof data.aiContext_json === 'object') {
                    aiContext = data.aiContext_json;
                }
            }
        } catch (error) {
            console.error('Error parsing AI context:', error);
            aiContext = undefined;
        }

        return {
            id: customerId,
            name: data.name,
            ownerUserId: data.ownerUserId,
            industry: data.industry || undefined,
            aiContext,
            permissions: permissions || {}
        };
    }

    async update(customerId: string, data: Partial<CustomerData>): Promise<Customer> {
        const mainKey = this.keys.customer(customerId);
        const existing = await this.getById(customerId);
        
        if (!existing) {
            throw new Error(`Customer with ID ${customerId} not found`);
        }

        const updatedData = {
            ...existing,
            ...data,
            id: customerId
        };

        await this.redis.hset(mainKey, {
            name: updatedData.name,
            ownerUserId: updatedData.ownerUserId,
            industry: updatedData.industry || '',
            aiContext_json: updatedData.aiContext ? JSON.stringify(updatedData.aiContext) : ''
        });

        return updatedData;
    }

    async delete(customerId: string): Promise<void> {
        const mainKey = this.keys.customer(customerId);
        const permissionsKey = this.keys.customerPermissions(customerId);
        const projectsKey = this.keys.customerProjects(customerId);

        // Get customer data to find owner
        const customer = await this.getById(customerId);
        if (!customer) return;

        // Get all users with permissions
        const permissions = await this.getPermissions(customerId);
        const userIds = Object.keys(permissions);

        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();

        // Delete main customer data
        pipe.del(mainKey);
        // Delete permissions
        pipe.del(permissionsKey);
        // Delete projects set
        pipe.del(projectsKey);

        // Remove from all users' customer sets
        for (const userId of userIds) {
            const userCustomersKey = this.keys.userCustomers(userId);
            pipe.zrem(userCustomersKey, customerId);
        }

        await pipe.exec();
    }

    async getPermissions(customerId: string): Promise<Record<string, UserRole>> {
        const permissionsKey = this.keys.customerPermissions(customerId);
        const permissions = await this.redis.hgetall<Record<string, string>>(permissionsKey);

        const validatedPermissions: Record<string, UserRole> = {};
        if (permissions) {
            for (const [userId, role] of Object.entries(permissions)) {
                if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer') {
                     validatedPermissions[userId] = role;
                }
            }
        }
        return validatedPermissions;
    }

    async setPermission(customerId: string, userId: string, role: UserRole): Promise<void> {
        const permissionsKey = this.keys.customerPermissions(customerId);
        const userCustomersKey = this.keys.userCustomers(userId);

        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();
        
        // Set permission in customer's permissions hash
        pipe.hset(permissionsKey, { [userId]: role });
        
        // Add/update in user's customer set with role priority
        pipe.zadd(userCustomersKey, { score: ROLE_PRIORITY[role], member: customerId });

        await pipe.exec();
    }

    async removePermission(customerId: string, userId: string): Promise<void> {
        const permissionsKey = this.keys.customerPermissions(customerId);
        const userCustomersKey = this.keys.userCustomers(userId);

        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();
        
        // Remove permission from customer's permissions hash
        pipe.hdel(permissionsKey, userId);
        
        // Remove from user's customer set
        pipe.zrem(userCustomersKey, customerId);

        await pipe.exec();
    }

    async setOwner(customerId: string, newOwnerUserId: string): Promise<void> {
        const mainKey = this.keys.customer(customerId);
        const permissionsKey = this.keys.customerPermissions(customerId);
        const userCustomersKey = this.keys.userCustomers(newOwnerUserId);

        // Get current owner
        const currentOwnerUserId = await this.redis.hget<string>(mainKey, 'ownerUserId');
        const currentOwnerCustomersKey = currentOwnerUserId ? 
            this.keys.userCustomers(currentOwnerUserId) : null;

        // Use pipeline for atomicity
        const pipe = this.redis.pipeline();
        
        // Update owner in main customer data
        pipe.hset(mainKey, { ownerUserId: newOwnerUserId });
        
        // Update permissions
        pipe.hset(permissionsKey, { [newOwnerUserId]: 'owner' });
        if (currentOwnerUserId) {
            pipe.hdel(permissionsKey, currentOwnerUserId);
        }
        
        // Update user-customer sets
        pipe.zadd(userCustomersKey, { score: ROLE_PRIORITY.owner, member: customerId });
        if (currentOwnerCustomersKey) {
            pipe.zrem(currentOwnerCustomersKey, customerId);
        }

        await pipe.exec();
    }

    async listUserCustomers(userId: string): Promise<CustomerAccess[]> {
        const userCustomersKey = this.keys.userCustomers(userId);
        const customerScores = await this.redis.zrange(userCustomersKey, 0, -1, { withScores: true });
        
        if (!Array.isArray(customerScores) || customerScores.length === 0) {
            console.log('No customers found for user:', userId);
            return [];
        }

        // Upstash Redis returns an array of [member, score, member, score, ...]
        const result: CustomerAccess[] = [];
        for (let i = 0; i < customerScores.length; i += 2) {
            const customerId = customerScores[i] as string;
            const score = customerScores[i + 1] as number;
            const role = Object.entries(ROLE_PRIORITY).find(([_, value]) => value === score)?.[0] as UserRole;
            if (role) {
                result.push({ customerId, role });
            }
        }
        return result;
    }

    async listUserCustomersWithDetails(userId: string): Promise<(Customer & { role: UserRole })[]> {
        console.log('Listing customers with details for user:', userId);
        
        const customerAccess = await this.listUserCustomers(userId);
        console.log('Customer access list:', customerAccess);
        
        if (customerAccess.length === 0) {
            console.log('No customer access found for user');
            return [];
        }

        const customers = await Promise.all(
            customerAccess.map(async ({ customerId, role }) => {
                console.log('Fetching customer:', customerId);
                const customer = await this.getById(customerId);
                //console.log('Retrieved customer:', customer);
                if (!customer) return null;
                
                // Create a new object with only the necessary properties
                const serializableCustomer: Customer & { role: UserRole } = {
                    id: customer.id,
                    name: customer.name,
                    ownerUserId: customer.ownerUserId,
                    industry: customer.industry,
                    aiContext: customer.aiContext,
                    permissions: customer.permissions || {},
                    role
                };
                
                return serializableCustomer;
            })
        );
        
        const validCustomers = customers.filter((c): c is Customer & { role: UserRole } => c !== null);
        //console.log('Valid customers with roles:', validCustomers);
        return validCustomers;
    }

    async addProject(customerId: string, projectId: string): Promise<void> {
        const projectsKey = this.keys.customerProjects(customerId);
        await this.redis.sadd(projectsKey, projectId);
    }

    async removeProject(customerId: string, projectId: string): Promise<void> {
        const projectsKey = this.keys.customerProjects(customerId);
        await this.redis.srem(projectsKey, projectId);
    }

    async getProjectIds(customerId: string): Promise<string[]> {
        const projectsKey = this.keys.customerProjects(customerId);
        return await this.redis.smembers(projectsKey);
    }
}