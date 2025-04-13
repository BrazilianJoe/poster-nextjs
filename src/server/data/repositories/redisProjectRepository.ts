import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { IProjectRepository } from '../interfaces';
import type { Project, ProjectData } from '../types';
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

export class RedisProjectRepository implements IProjectRepository {
    private redis: Redis;
    private keys: RedisKeys;

    constructor(redisClient: Redis, namespace: string = '') {
        this.redis = redisClient;
        this.keys = new RedisKeys(namespace);
    }

    // --- Core CRUD ---
    async create(data: ProjectData): Promise<Project> {
        return this.upsert(data, { mode: 'create' });
    }

    async getById(projectId: string): Promise<Project | null> {
        const mainKey = this.keys.project(projectId);
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
        // Check existence AND type before parsing
        if (data.aiContext_json && typeof data.aiContext_json === 'string') {
            try {
                aiContext = JSON.parse(data.aiContext_json);
            } catch (e) {
                console.error(`Failed to parse aiContext_json for project ${projectId}`, e);
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
             console.warn(`aiContext_json for project ${projectId} was not an object:`, data.aiContext_json);
        }

        return {
            id: projectId,
            name: data.name,
            customerId: data.customerId,
            objective: typeof data.objective === 'string' ? data.objective : undefined,
            aiContext: aiContext,
        };
    }

    async getAiContext(projectId: string): Promise<Record<string, any> | null> {
        const mainKey = this.keys.project(projectId);
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

    async updateBasicInfo(projectId: string, data: Partial<{ name: string; objective: string; }>): Promise<void> {
        const existingProject = await this.getById(projectId);
        if (!existingProject) {
            throw new Error(`Project with ID ${projectId} not found.`);
        }

        // Prepare the full data object expected by upsert, merging existing with updates
        // Only include name/objective if they are actually provided in the partial data
        const upsertData: ProjectData = {
            name: data.name ?? existingProject.name, // Use new name if provided, else existing
            customerId: existingProject.customerId, // Customer doesn't change here
            objective: data.objective !== undefined ? data.objective : existingProject.objective, // Use new objective if provided (even if null/empty string), else existing
            aiContext: existingProject.aiContext, // AI context doesn't change here
        };

        // Call upsert in update mode, providing the ID
        await this.upsert(upsertData, { mode: 'update', projectId: projectId });
        // updateBasicInfo doesn't return anything
    }

    async updateAiContext(projectId: string, context: Record<string, any>): Promise<void> {
        const mainKey = this.keys.project(projectId);
        // Check if project exists first? Optional.
        // Pass the raw context object to cleanHashData, which will stringify it.
        await this.redis.hset(mainKey, cleanHashData({ aiContext_json: context }));
    }

    async setCustomer(projectId: string, customerId: string): Promise<void> {
        const mainKey = this.keys.project(projectId);
        // Optional: Check if project exists first
        await this.redis.hset(mainKey, { customerId: customerId });
        // Note: Updating the customer's project sets (removing from old, adding to new)
        // must be handled by the service layer coordinating with ICustomerRepository.
    }

    async getCustomerId(projectId: string): Promise<string | null> {
        const mainKey = this.keys.project(projectId);
        const customerId = await this.redis.hget<string>(mainKey, 'customerId');
        return customerId; // Already string | null
    }

    // --- Conversation Relationships ---
    async addConversation(projectId: string, conversationId: string): Promise<void> {
        const conversationsKey = this.keys.projectConversations(projectId);
        await this.redis.sadd(conversationsKey, conversationId);
    }

    async removeConversation(projectId: string, conversationId: string): Promise<void> {
        const conversationsKey = this.keys.projectConversations(projectId);
        await this.redis.srem(conversationsKey, conversationId);
    }

    async getConversationIds(projectId: string): Promise<string[]> {
        const conversationsKey = this.keys.projectConversations(projectId);
        return await this.redis.smembers(conversationsKey);
    }

    // --- Post Relationships ---
    async addPost(projectId: string, postId: string): Promise<void> {
        const postsKey = this.keys.projectPosts(projectId);
        await this.redis.sadd(postsKey, postId);
    }

    async removePost(projectId: string, postId: string): Promise<void> {
        const postsKey = this.keys.projectPosts(projectId);
        await this.redis.srem(postsKey, postId);
    }

    async getPostIds(projectId: string): Promise<string[]> {
        const postsKey = this.keys.projectPosts(projectId);
        return await this.redis.smembers(postsKey);
    }

    // Public upsert method implementing user requirements
    async upsert(data: ProjectData, options?: { mode?: 'create' | 'update', projectId?: string }): Promise<Project> {
        const mode = options?.mode;
        const providedProjectId = options?.projectId;
        let effectiveProjectId: string;

        if (!mode) {
            // Default mode could be inferred, but explicit is safer. Let's require it.
            // If we wanted to infer: if providedProjectId exists -> 'update', else 'create'
            throw new Error("Operation mode ('create' or 'update') must be specified in options.");
        }

        if (mode === 'update') {
            if (!providedProjectId) {
                throw new Error('Project ID must be provided in options for update mode.');
            }
            // Verify project exists before update
            const keyExists = await this.redis.exists(this.keys.project(providedProjectId));
            if (!keyExists) {
                 throw new Error(`Project with ID ${providedProjectId} not found for update.`);
            }
            effectiveProjectId = providedProjectId;
        } else { // mode === 'create'
            if (providedProjectId) {
                // Create with specific ID - check if it already exists
                const keyExists = await this.redis.exists(this.keys.project(providedProjectId));
                if (keyExists) {
                    throw new Error(`Project with ID ${providedProjectId} already exists. Cannot create.`);
                }
                effectiveProjectId = providedProjectId;
            } else {
                // Create with new ID
                effectiveProjectId = uuidv4();
            }
        }

        const mainKey = this.keys.project(effectiveProjectId);

        // Prepare data hash (ensure clean data)
        const projectDataForHash = cleanHashData({
            name: data.name,
            customerId: data.customerId,
            objective: data.objective,
            // Pass raw object to cleanHashData, let it handle stringification
            aiContext_json: data.aiContext,
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

    async delete(projectId: string): Promise<void> {
        const mainKey = this.keys.project(projectId);
        const conversationsKey = this.keys.projectConversations(projectId);
        const postsKey = this.keys.projectPosts(projectId);

        // Get all conversation IDs before deleting the project
        const conversationIds = await this.getConversationIds(projectId);

        // Delete the main project data
        await this.redis.del(mainKey);
        // Delete the conversations set
        await this.redis.del(conversationsKey);
        // Delete the posts set
        await this.redis.del(postsKey);

        // Note: The actual deletion of conversations and posts should be handled by the service layer
        // as it needs to coordinate with other repositories
    }

    async listByCustomer(customerId: string): Promise<Project[]> {
        // Get all project keys
        const projectKeys = await this.redis.keys(this.keys.project('*'));
        
        // Get all projects and filter by customerId
        const projects = await Promise.all(
            projectKeys.map(async (key) => {
                const projectId = key.replace(this.keys.project(''), '');
                const project = await this.getById(projectId);
                return project;
            })
        );
        
        // Filter out null values and projects that don't belong to the customer
        return projects.filter((project): project is Project => 
            project !== null && project.customerId === customerId
        );
    }
}