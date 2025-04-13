import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { ICustomerRepository } from '../interfaces';
import type { Customer, CustomerData, UserRole } from '../types';
import { RedisKeys } from './redisKeys';

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

    constructor(redisClient: Redis, namespace: string = '') {
        this.redis = redisClient;
        this.keys = new RedisKeys(namespace);
    }

    // --- Core CRUD ---
    async create(data: CustomerData): Promise<Customer> {
        return this.upsert(data, { mode: 'create' });
    }

    async getById(customerId: string): Promise<Customer | null> {
        const mainKey = this.keys.customer(customerId);
        console.log(`Retrieving customer data for key: ${mainKey}`);
        const data = await this.redis.hgetall(mainKey);
        console.log(`Retrieved data:`, data);

        if (!data) {
            return null; // Key doesn't exist
        }

        // Validate essential fields
        if (typeof data.name !== 'string' || typeof data.ownerUserId !== 'string') {
            console.error(`Incomplete or invalid customer data found for key: ${mainKey}`, data);
            return null;
        }

        let aiContext: Record<string, any> | undefined = undefined;
        // Check existence AND type before parsing
        if (data.aiContext_json && typeof data.aiContext_json === 'string') {
            try {
                aiContext = JSON.parse(data.aiContext_json);
            } catch (e) {
                console.error(`Failed to parse aiContext_json for customer ${customerId}`, e);
                // Decide handling: return null, return partial, ignore? Ignoring for now.
            }
        }

        // @upstash/redis hgetall seems to auto-parse JSON strings.
        // Assign directly if it's an object, otherwise treat as undefined/null.
        // Add more robust type validation if needed (e.g., using Zod).
        if (data.aiContext_json && typeof data.aiContext_json === 'object') {
             aiContext = data.aiContext_json as Record<string, any>;
        } else if (data.aiContext_json) {
             // Log if it exists but isn't an object (unexpected)
             console.warn(`aiContext_json for customer ${customerId} was not an object:`, data.aiContext_json);
        }

        return {
            id: customerId,
            name: data.name,
            ownerUserId: data.ownerUserId,
            industry: typeof data.industry === 'string' ? data.industry : undefined,
            aiContext: aiContext,
        };
    }

    async updateBasicInfo(customerId: string, data: Partial<{ name: string; industry: string; }>): Promise<void> {
        const existingCustomer = await this.getById(customerId);
        if (!existingCustomer) {
            throw new Error(`Customer with ID ${customerId} not found.`);
        }

        // Prepare the full data object expected by upsert, merging existing with updates
        // Only include name/industry if they are actually provided in the partial data
        const upsertData: CustomerData = {
            name: data.name ?? existingCustomer.name, // Use new name if provided, else existing
            ownerUserId: existingCustomer.ownerUserId, // Owner doesn't change here
            industry: data.industry !== undefined ? data.industry : existingCustomer.industry, // Use new industry if provided (even if null/empty string), else existing
            aiContext: existingCustomer.aiContext, // AI context doesn't change here
        };

        // Call upsert in update mode, providing the ID
        await this.upsert(upsertData, { mode: 'update', customerId: customerId });
        // updateBasicInfo doesn't return anything
    }

    async updateAiContext(customerId: string, context: Record<string, any>): Promise<void> {
        const mainKey = this.keys.customer(customerId);
        // Check if customer exists first? Optional.
        // Pass the raw context object to cleanHashData, which will stringify it.
        await this.redis.hset(mainKey, cleanHashData({ aiContext_json: context }));
    }

    async setOwner(customerId: string, newOwnerUserId: string): Promise<void> {
        const mainKey = this.keys.customer(customerId);
        const permissionsKey = this.keys.customerPermissions(customerId);

        // Get current owner to update their permission
        const currentOwnerUserId = await this.getOwnerUserId(customerId);
        if (!currentOwnerUserId) {
            // Should not happen if customer exists, but handle defensively
            console.warn(`Setting owner for customer ${customerId} which seems to lack an owner.`);
            // Proceed to set the new owner anyway? Or throw error? Let's proceed.
        }

        // Use pipeline for atomicity as it modifies multiple keys/fields
        const pipe = this.redis.pipeline();
        // Update owner field in main hash
        pipe.hset(mainKey, { ownerUserId: newOwnerUserId }); // Simplified hset usage
        // Update permissions hash: set new owner, remove old owner permission
        pipe.hset(permissionsKey, { [newOwnerUserId]: 'owner' });
        if (currentOwnerUserId && currentOwnerUserId !== newOwnerUserId) {
            pipe.hdel(permissionsKey, currentOwnerUserId);
        }
        await pipe.exec(); // Execute pipeline
    }

    async getOwnerUserId(customerId: string): Promise<string | null> {
        const mainKey = this.keys.customer(customerId);
        // HGET returns the value or null if field/key doesn't exist
        const ownerId = await this.redis.hget<string>(mainKey, 'ownerUserId');
        return ownerId; // Already string | null
    }

    // --- Project Relationships ---
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

    // --- Permissions ---
    async getPermissions(customerId: string): Promise<Record<string, UserRole>> {
        const permissionsKey = this.keys.customerPermissions(customerId);
        const permissions = await this.redis.hgetall(permissionsKey);

        const validatedPermissions: Record<string, UserRole> = {};
        if (permissions) {
            for (const [userId, role] of Object.entries(permissions)) {
                // Ensure role is one of the allowed UserRole types
                if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer') {
                     validatedPermissions[userId] = role;
                } else {
                     console.warn(`Invalid role '${role}' found for user ${userId} on customer ${customerId}`);
                }
            }
        }
        return validatedPermissions;
    }

    async setPermission(customerId: string, userId: string, role: UserRole): Promise<void> {
        const permissionsKey = this.keys.customerPermissions(customerId);
        // Ensure owner permission isn't set directly if it conflicts with main owner field?
        // Service layer should probably validate this. Repository just sets what's asked.
        // if (role === 'owner') {
        //     const currentOwner = await this.getOwnerUserId(customerId);
        //     if (userId !== currentOwner) {
        //         console.warn(`Attempting to set non-owner user ${userId} as 'owner' in permissions hash for customer ${customerId}. Use setOwner method instead.`);
        //         // Decide: throw error, ignore, or proceed? Let's proceed for now.
        //     }
        // }
        // Use object syntax, ensure clean data
        await this.redis.hset(permissionsKey, cleanHashData({ [userId]: role }));
    }

    // Public upsert method implementing user requirements
    async upsert(data: CustomerData, options?: { mode?: 'create' | 'update', customerId?: string }): Promise<Customer> {
        const mode = options?.mode;
        const providedCustomerId = options?.customerId;
        let effectiveCustomerId: string;

        if (!mode) {
            // Default mode could be inferred, but explicit is safer. Let's require it.
            // If we wanted to infer: if providedCustomerId exists -> 'update', else 'create'
            throw new Error("Operation mode ('create' or 'update') must be specified in options.");
        }

        if (mode === 'update') {
            if (!providedCustomerId) {
                throw new Error('Customer ID must be provided in options for update mode.');
            }
            // Verify customer exists before update
            const keyExists = await this.redis.exists(this.keys.customer(providedCustomerId));
            if (!keyExists) {
                 throw new Error(`Customer with ID ${providedCustomerId} not found for update.`);
            }
            effectiveCustomerId = providedCustomerId;
        } else { // mode === 'create'
            if (providedCustomerId) {
                // Create with specific ID - check if it already exists
                const keyExists = await this.redis.exists(this.keys.customer(providedCustomerId));
                if (keyExists) {
                    throw new Error(`Customer with ID ${providedCustomerId} already exists. Cannot create.`);
                }
                effectiveCustomerId = providedCustomerId;
            } else {
                // Create with new ID
                effectiveCustomerId = uuidv4();
            }
        }

        const mainKey = this.keys.customer(effectiveCustomerId);
        const permissionsKey = this.keys.customerPermissions(effectiveCustomerId);

        // Prepare data hash (ensure clean data)
        const customerDataForHash = cleanHashData({
            name: data.name,
            ownerUserId: data.ownerUserId,
            industry: data.industry,
            // Pass raw object to cleanHashData, let it handle stringification
            aiContext_json: data.aiContext,
        });

        // Perform Redis operations (no pipeline needed unless updating multiple related keys atomically)
        await this.redis.hset(mainKey, customerDataForHash);

        if (mode === 'create') {
            // Set owner permission only on create
            await this.redis.hset(permissionsKey, { [data.ownerUserId]: 'owner' });
        }

        // Return the final state of the customer
        // Note: We return the input data merged with the effective ID,
        // assuming the hset was successful. We don't re-fetch from Redis here.
        return {
            id: effectiveCustomerId,
            name: data.name,
            ownerUserId: data.ownerUserId,
            industry: data.industry,
            aiContext: data.aiContext,
        };
    }

    async delete(customerId: string): Promise<void> {
        const mainKey = this.keys.customer(customerId);
        const permissionsKey = this.keys.customerPermissions(customerId);
        const projectsKey = this.keys.customerProjects(customerId);

        // Get all project IDs before deleting the customer
        const projectIds = await this.getProjectIds(customerId);

        // Delete the main customer data
        await this.redis.del(mainKey);
        // Delete the permissions data
        await this.redis.del(permissionsKey);
        // Delete the projects set
        await this.redis.del(projectsKey);

        // Note: The actual deletion of projects should be handled by the service layer
        // as it needs to coordinate with other repositories
    }

    async listByOwner(ownerUserId: string): Promise<Customer[]> {
        // This is a bit tricky as we don't have a direct index for owner -> customers
        // We'll need to scan all customers and filter by owner
        const pattern = this.keys.customer('*');
        const keys = await this.redis.keys(pattern);
        
        const customers: Customer[] = [];
        for (const key of keys) {
            try {
                const data = await this.redis.hgetall(key);
                if (!data) {
                    console.warn(`No data found for key: ${key}`);
                    continue;
                }

                // Validate essential fields
                if (typeof data.ownerUserId !== 'string' || typeof data.name !== 'string') {
                    console.warn(`Invalid data found for key: ${key}`, data);
                    continue;
                }

                // Only include customers owned by the specified user
                if (data.ownerUserId !== ownerUserId) {
                    continue;
                }

                let aiContext: Record<string, any> | undefined = undefined;
                
                // Handle aiContext_json parsing similar to getById
                if (data.aiContext_json) {
                    if (typeof data.aiContext_json === 'string') {
                        try {
                            aiContext = JSON.parse(data.aiContext_json);
                        } catch (e) {
                            console.error(`Failed to parse aiContext_json for customer ${key.replace(this.keys.customer(''), '')}`, e);
                        }
                    } else if (typeof data.aiContext_json === 'object') {
                        aiContext = data.aiContext_json as Record<string, any>;
                    } else {
                        console.warn(`aiContext_json for customer ${key.replace(this.keys.customer(''), '')} was not a string or object:`, data.aiContext_json);
                    }
                }

                customers.push({
                    id: key.replace(this.keys.customer(''), ''),
                    name: data.name,
                    ownerUserId: data.ownerUserId,
                    industry: typeof data.industry === 'string' ? data.industry : undefined,
                    aiContext: aiContext,
                });
            } catch (error) {
                console.warn(`Failed to process customer data for key: ${key}`, error);
                continue;
            }
        }
        return customers;
    }

    async getAiContext(customerId: string): Promise<Record<string, any> | null> {
        const mainKey = this.keys.customer(customerId);
        const contextValue = await this.redis.hget(mainKey, 'aiContext_json');

        // Check if it's already an object (potential auto-parsing by Upstash client?)
        if (contextValue !== null && typeof contextValue === 'object') {
            // Assuming it's the correct structure, might need validation (e.g., Zod)
            return contextValue as Record<string, any>;
        }
        // Check if it's a string that needs parsing
        else if (typeof contextValue === 'string') {
             try {
                 return JSON.parse(contextValue);
             } catch (e) {
                 console.error(`Failed to parse aiContext_json for customer ${customerId}`, e);
                 return null; // Indicate parsing error
             }
        }
        // Field doesn't exist, is null, or is some other unexpected type
        return null;
    }

    async removePermission(customerId: string, userId: string): Promise<void> {
        const permissionsKey = this.keys.customerPermissions(customerId);
        // Prevent removing the actual owner's permission entry?
        const owner = await this.getOwnerUserId(customerId);
        if (userId === owner) {
            // This might leave the customer without an owner permission entry, which could be bad.
            // Maybe throw an error or require using setOwner to change ownership.
            console.warn(`Attempted to remove permission for the owner (${userId}) of customer ${customerId}. Use setOwner to change ownership.`);
            // Let's prevent removal of the owner's permission entry here for safety.
            // throw new Error(`Cannot remove permission for the designated owner (${userId}). Use setOwner to change ownership.`);
            return; // Or silently do nothing
        }
        await this.redis.hdel(permissionsKey, userId);
    }

    async getPermissionForUser(customerId: string, userId: string): Promise<UserRole | null> {
        const permissionsKey = this.keys.customerPermissions(customerId);
        const role = await this.redis.hget<string | null>(permissionsKey, userId); // Specify expected type from hget

        // Correctly check if the retrieved role is a valid UserRole string
        if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer') {
            return role; // Now role is confirmed to be UserRole
        }
        // Log if an unexpected value was retrieved? Optional.
        // if (role !== null) {
        //     console.warn(`Unexpected value retrieved for permission role: ${role}`);
        // }
        return null; // No permission or invalid/unexpected role stored
    }
}