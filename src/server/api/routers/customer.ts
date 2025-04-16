import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { RedisCustomerRepository } from "~/server/data/repositories/redisCustomerRepository";
import { RedisUserRepository } from "~/server/data/repositories/redisUserRepository";
import { redis } from "~/server/data/redis";
import type { Customer, CustomerData, UserRole } from "~/server/data/types";
import { RedisKeys } from "~/server/data/repositories/redisKeys";

const customerRepository = new RedisCustomerRepository(redis);
const userRepository = new RedisUserRepository(redis);
const keys = new RedisKeys();

// Define the context type
type Context = {
  userId?: string;
  headers: Headers;
};

export const customerRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    console.log("Customer router - list - clerkId:", ctx.userId);
    
    // Find internal user ID using Clerk ID
    const user = await userRepository.findByClerkId(ctx.userId!);
    if (!user) {
      console.log("No internal user found for Clerk ID:", ctx.userId);
      return [];
    }
    
    console.log("Found internal user:", user.id);
    const customers = await customerRepository.listUserCustomersWithDetails(user.id);
    console.log("Customer router - list - customers:", customers);
    return customers;
  }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getById(customerId);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      ownerUserId: z.string(),
      industry: z.string().optional(),
      aiContext: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      return customerRepository.create(input);
    }),

  update: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      name: z.string().optional(),
      industry: z.string().optional(),
      aiContext: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input: { customerId, ...data } }) => {
      return customerRepository.update(customerId, data);
    }),

  setOwner: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      ownerUserId: z.string(),
    }))
    .mutation(async ({ input: { customerId, ownerUserId } }) => {
      return customerRepository.setOwner(customerId, ownerUserId);
    }),

  // Project Relationships
  addProject: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      projectId: z.string(),
    }))
    .mutation(async ({ input: { customerId, projectId } }) => {
      return customerRepository.addProject(customerId, projectId);
    }),

  removeProject: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      projectId: z.string(),
    }))
    .mutation(async ({ input: { customerId, projectId } }) => {
      return customerRepository.removeProject(customerId, projectId);
    }),

  getProjectIds: protectedProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getProjectIds(customerId);
    }),

  // Permissions
  getPermissions: protectedProcedure
    .input(z.string())
    .query(async ({ input: customerId }) => {
      return customerRepository.getPermissions(customerId);
    }),

  setPermission: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      userId: z.string(),
      role: z.enum(['owner', 'admin', 'editor', 'viewer']),
    }))
    .mutation(async ({ input: { customerId, userId, role } }) => {
      return customerRepository.setPermission(customerId, userId, role);
    }),

  removePermission: protectedProcedure
    .input(z.object({
      customerId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ input: { customerId, userId } }) => {
      return customerRepository.removePermission(customerId, userId);
    }),

  getActive: protectedProcedure.query(async ({ ctx }) => {
    // Get the current user's ID from the context
    const userId = (ctx as Context).userId;
    if (!userId) {
      console.log('No user ID found in context');
      return null;
    }

    // Find internal user ID using Clerk ID
    const user = await userRepository.findByClerkId(userId);
    if (!user) {
      console.log('No internal user found for Clerk ID:', userId);
      return null;
    }

    // Get all customers the user has access to
    const customerAccess = await customerRepository.listUserCustomers(user.id);
    if (customerAccess.length === 0) {
      console.log('No customers found for user');
      return null;
    }

    // Get the first customer's details
    const firstCustomerId = customerAccess[0]?.customerId;
    if (!firstCustomerId) {
      console.log('No customer ID found in access list');
      return null;
    }

    const firstCustomer = await customerRepository.getById(firstCustomerId);
    if (!firstCustomer) {
      console.log('First customer not found');
      return null;
    }

    return firstCustomer;
  }),
}); 