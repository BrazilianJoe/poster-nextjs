import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import { RedisProjectRepository } from "~/server/data/repositories/redisProjectRepository"
import { RedisCustomerRepository } from "~/server/data/repositories/redisCustomerRepository"
import { RedisUserRepository } from "~/server/data/repositories/redisUserRepository"
import { redis } from "~/server/data/redis"
import type { Project } from "~/server/data/types"
import { z } from "zod"
import { TRPCError } from "@trpc/server"

const projectRepository = new RedisProjectRepository(redis)
const customerRepository = new RedisCustomerRepository(redis)
const userRepository = new RedisUserRepository(redis)

export const projectRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.string().optional())
    .query(async ({ ctx, input: customerId }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to access projects'
        })
      }

      // Find internal user ID using Clerk ID
      const user = await userRepository.findByClerkId(ctx.userId);
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found in system'
        })
      }

      // If no customer ID is provided, return all projects the user has access to
      if (!customerId) {
        // Get all customers the user has access to
        const customerAccess = await customerRepository.listUserCustomers(user.id);
        const customerIds = customerAccess.map(c => c.customerId);
        
        const projects = await Promise.all(
          (await redis.keys("proj:*"))
            .filter((key: string) => !key.includes(":conversations") && !key.includes(":posts"))
            .map((key: string) => projectRepository.getById(key.replace("proj:", "")))
        )
        return projects.filter((project: Project | null): project is Project => 
          project !== null && customerIds.includes(project.customerId)
        )
      }

      // If customer ID is provided, verify the user has access to this customer
      const customerAccess = await customerRepository.listUserCustomers(user.id);
      const hasAccess = customerAccess.some(c => c.customerId === customerId);
      
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have permission to access this customer's projects"
        })
      }

      // Return projects for the specified customer
      const projects = await Promise.all(
        (await redis.keys("proj:*"))
          .filter((key: string) => !key.includes(":conversations") && !key.includes(":posts"))
          .map((key: string) => projectRepository.getById(key.replace("proj:", "")))
      )
      return projects.filter((project: Project | null): project is Project => 
        project !== null && project.customerId === customerId
      )
    }),
}) 