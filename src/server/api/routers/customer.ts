import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { RedisCustomerRepository } from "~/server/data/repositories/redisCustomerRepository";
import { redis } from "~/server/data/redis";
import type { Customer, CustomerData, UserRole } from "~/server/data/types";
import { RedisKeys } from "~/server/data/repositories/redisKeys";

const customerRepository = new RedisCustomerRepository(redis);
const keys = new RedisKeys();

export const customerRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    // First, let's see all keys in Redis
    const allKeys = await redis.keys('*');
    console.log('All Redis keys:', allKeys);

    // Get all customer keys using the RedisKeys pattern
    const customerPattern = keys.customer('*');
    console.log('Customer pattern:', customerPattern);
    const customerKeys = await redis.keys(customerPattern);
    console.log('Found customer keys:', customerKeys);
    
    if (customerKeys.length === 0) {
      console.log('No customer keys found. Checking with direct pattern...');
      const directKeys = await redis.keys('cust:*');
      console.log('Direct pattern keys:', directKeys);
      if (directKeys.length > 0) {
        customerKeys.push(...directKeys);
      }
    }
    
    // Get each customer by ID (remove the prefix)
    const customers = await Promise.all(
      customerKeys.map((key: string) => {
        // Extract the ID by removing the namespace and prefix
        const id = key.replace(/^.*cust:/, '');
        console.log(`Processing key: ${key}`);
        console.log(`Extracted ID: ${id}`);
        return customerRepository.getById(id);
      })
    );

    // Filter out null values (in case any customer was deleted)
    const validCustomers = customers.filter((customer: Customer | null): customer is Customer => customer !== null);
    console.log('Found valid customers:', validCustomers.length);
    console.log('Valid customers:', validCustomers);
    return validCustomers;
  }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getById(customerId);
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string(),
      ownerUserId: z.string(),
      industry: z.string().optional(),
      aiContext: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      return customerRepository.create(input);
    }),

  updateBasicInfo: publicProcedure
    .input(z.object({
      customerId: z.string(),
      name: z.string().optional(),
      industry: z.string().optional(),
    }))
    .mutation(async ({ input: { customerId, ...data } }) => {
      return customerRepository.updateBasicInfo(customerId, data);
    }),

  updateAiContext: publicProcedure
    .input(z.object({
      customerId: z.string(),
      context: z.record(z.any()),
    }))
    .mutation(async ({ input: { customerId, context } }) => {
      return customerRepository.updateAiContext(customerId, context);
    }),

  getAiContext: publicProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getAiContext(customerId);
    }),

  setOwner: publicProcedure
    .input(z.object({
      customerId: z.string(),
      ownerUserId: z.string(),
    }))
    .mutation(async ({ input: { customerId, ownerUserId } }) => {
      return customerRepository.setOwner(customerId, ownerUserId);
    }),

  getOwnerUserId: publicProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getOwnerUserId(customerId);
    }),

  // Project Relationships
  addProject: publicProcedure
    .input(z.object({
      customerId: z.string(),
      projectId: z.string(),
    }))
    .mutation(async ({ input: { customerId, projectId } }) => {
      return customerRepository.addProject(customerId, projectId);
    }),

  removeProject: publicProcedure
    .input(z.object({
      customerId: z.string(),
      projectId: z.string(),
    }))
    .mutation(async ({ input: { customerId, projectId } }) => {
      return customerRepository.removeProject(customerId, projectId);
    }),

  getProjectIds: publicProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getProjectIds(customerId);
    }),

  // Permissions
  getPermissions: publicProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getPermissions(customerId);
    }),

  setPermission: publicProcedure
    .input(z.object({
      customerId: z.string(),
      userId: z.string(),
      role: z.enum(['owner', 'admin', 'editor', 'viewer']),
    }))
    .mutation(async ({ input: { customerId, userId, role } }) => {
      return customerRepository.setPermission(customerId, userId, role);
    }),

  removePermission: publicProcedure
    .input(z.object({
      customerId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input: { customerId, userId } }) => {
      return customerRepository.removePermission(customerId, userId);
    }),

  getPermissionForUser: publicProcedure
    .input(z.object({
      customerId: z.string(),
      userId: z.string(),
    }))
    .query(async ({ input: { customerId, userId } }) => {
      return customerRepository.getPermissionForUser(customerId, userId);
    }),

  listByOwner: publicProcedure
    .input(z.string())
    .query(async ({ input: ownerUserId }) => {
      return customerRepository.listByOwner(ownerUserId);
    }),
}); 