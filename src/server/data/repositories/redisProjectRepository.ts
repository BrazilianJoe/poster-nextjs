import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { IProjectRepository } from '../interfaces';
import type { Project, ProjectData } from '../types';

// Helper function (consider moving to a shared utils file)
// Ensures values are suitable for Redis hash (strings, numbers, booleans)
function cleanHashData(data: Record<string, any>): Record<string, string | number | boolean> {
    const cleaned: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined) {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                 cleaned[key] = value;
            } else {
                 cleaned[key] = JSON.stringify(value);
            }
        }
    }
    return cleaned;
}

export class RedisProjectRepository implements IProjectRepository {
    private redis: Redis;
    private keyPrefix = 'proj:';
    private conversationsSuffix = ':conversations';

    constructor(redisClient: Redis) {
        this.redis = redisClient;
    }

    // --- Key Generation ---
    private getMainKey(projectId: string): string {
        return `${this.keyPrefix}${projectId}`;
    }
    private getConversationsKey(projectId: string): string {
        return `${this.getMainKey(projectId)}${this.conversationsSuffix}`;
    }

    // --- Core CRUD ---
    // Thin wrapper for create
    async create(data: ProjectData): Promise<Project> {
        return this.upsert(data, { mode: 'create' });
    }

    // Thin wrapper for update
    async update(projectId: string, data: Partial<ProjectData>): Promise<Project> {
        const existingProject = await this.getById(projectId);
        if (!existingProject) {
            throw new Error(`Project with ID ${projectId} not found.`);
        }
        // Merge existing data with the partial update data
        // Ensure customerId is always present in the merged data for upsert
        const mergedData: ProjectData = {
            name: data.name ?? existingProject.name,
            customerId: data.customerId ?? existingProject.customerId, // Keep existing customerId if not provided
            objective: data.objective !== undefined ? data.objective : existingProject.objective, // Allow setting objective to null/empty
            aiContext: data.aiContext !== undefined ? data.aiContext : existingProject.aiContext, // Allow setting aiContext to null/empty
        };
        return this.upsert(mergedData, { mode: 'update', projectId: projectId });
    }


    async getById(projectId: string): Promise<Project | null> {
        const mainKey = this.getMainKey(projectId);
        const data = await this.redis.hgetall(mainKey);

        if (!data) {
            return null; // Key doesn't exist
        }

        // Validate essential fields
        if (typeof data.name !== 'string' || typeof data.customerId !== 'string') {
            console.error(`Incomplete or invalid project data found for key: ${mainKey}`, data);
            return null;
        }

        let aiContext: Record<string, any> | undefined = undefined;
        // Check if it's a string needing parsing
        if (typeof data.aiContext_json === 'string') {
            try {
                aiContext = JSON.parse(data.aiContext_json);
            } catch (e) {
                console.error(`Failed to parse aiContext_json string for project ${projectId}`, e);
                // Decide handling: return null, return partial, ignore? Ignoring for now.
            }
        // Check if it's already an object (potential auto-parsing by Upstash client)
        } else if (data.aiContext_json && typeof data.aiContext_json === 'object') {
            // Assuming it's the correct structure, might need validation (e.g., Zod)
            aiContext = data.aiContext_json as Record<string, any>;
        } else if (data.aiContext_json) {
            // Log if it exists but isn't a string or object (unexpected)
            console.warn(`aiContext_json for project ${projectId} was not a string or object:`, data.aiContext_json);
        }


        return {
            id: projectId,
            name: data.name,
            customerId: data.customerId,
            objective: typeof data.objective === 'string' ? data.objective : undefined,
            aiContext: aiContext,
        };
    }

    async updateBasicInfo(projectId: string, data: Partial<{ name: string; objective: string; }>): Promise<void> {
        const mainKey = this.getMainKey(projectId);
        const updateData: Record<string, string> = {};
         if (data.name !== undefined) updateData.name = data.name;
         if (data.objective !== undefined) updateData.objective = data.objective;

        if (Object.keys(updateData).length > 0) {
            // Optional: Check if project exists first
            await this.redis.hset(mainKey, updateData);
        }
    }

    async updateAiContext(projectId: string, context: Record<string, any>): Promise<void> {
        const mainKey = this.getMainKey(projectId);
        // Optional: Check if project exists first
        await this.redis.hset(mainKey, { aiContext_json: JSON.stringify(context) });
    }

    async getAiContext(projectId: string): Promise<Record<string, any> | null> {
        const mainKey = this.getMainKey(projectId);
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
                 console.error(`Failed to parse aiContext_json string for project ${projectId}`, e);
                 return null; // Indicate parsing error
             }
        }
        // Field doesn't exist, is null, or is some other unexpected type
        return null;
    }

    async setCustomer(projectId: string, customerId: string): Promise<void> {
        const mainKey = this.getMainKey(projectId);
        // Optional: Check if project exists first
        await this.redis.hset(mainKey, { customerId: customerId });
        // Note: Updating the customer's project sets (removing from old, adding to new)
        // must be handled by the service layer coordinating with ICustomerRepository.
    }

    async getCustomerId(projectId: string): Promise<string | null> {
        const mainKey = this.getMainKey(projectId);
        const customerId = await this.redis.hget<string>(mainKey, 'customerId');
        return customerId; // Already string | null
    }

    // --- Conversation Relationships ---
    async addConversation(projectId: string, conversationId: string): Promise<void> {
        const conversationsKey = this.getConversationsKey(projectId);
        await this.redis.sadd(conversationsKey, conversationId);
    }

    async removeConversation(projectId: string, conversationId: string): Promise<void> {
        const conversationsKey = this.getConversationsKey(projectId);
        await this.redis.srem(conversationsKey, conversationId);
    }

    async getConversationIds(projectId: string): Promise<string[]> {
        const conversationsKey = this.getConversationsKey(projectId);
        return await this.redis.smembers(conversationsKey);
    }

    // --- Upsert Implementation ---
    async upsert(data: ProjectData, options?: { mode?: 'create' | 'update', projectId?: string }): Promise<Project> {
        const mode = options?.mode;
        const providedProjectId = options?.projectId;
        let effectiveProjectId: string;

        if (!mode) {
            throw new Error("Operation mode ('create' or 'update') must be specified in options.");
        }

        if (mode === 'update') {
            if (!providedProjectId) {
                throw new Error('Project ID must be provided in options for update mode.');
            }
            // Verify project exists before update
            const keyExists = await this.redis.exists(this.getMainKey(providedProjectId));
            if (!keyExists) {
                 throw new Error(`Project with ID ${providedProjectId} not found for update.`);
            }
            effectiveProjectId = providedProjectId;
        } else { // mode === 'create'
            if (providedProjectId) {
                // Create with specific ID - check if it already exists
                const keyExists = await this.redis.exists(this.getMainKey(providedProjectId));
                if (keyExists) {
                    throw new Error(`Project with ID ${providedProjectId} already exists. Cannot create.`);
                }
                effectiveProjectId = providedProjectId;
            } else {
                // Create with new ID
                effectiveProjectId = uuidv4();
            }
        }

        const mainKey = this.getMainKey(effectiveProjectId);

        // Prepare data hash using cleanHashData
        const projectDataForHash = cleanHashData({
            name: data.name,
            customerId: data.customerId,
            objective: data.objective, // Pass directly, cleanHashData handles undefined
            aiContext_json: data.aiContext, // Pass object, cleanHashData handles stringification
        });

        // Perform Redis operation
        await this.redis.hset(mainKey, projectDataForHash);

        // Note: Project creation/update doesn't involve setting owner permissions like Customer.
        // Linking project to customer (cust:<id>:projects) should happen in the service layer.

        // Return the final state of the project
        return {
            id: effectiveProjectId,
            name: data.name,
            customerId: data.customerId,
            objective: data.objective,
            aiContext: data.aiContext,
        };
    }
}