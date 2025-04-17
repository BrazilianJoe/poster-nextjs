import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { RedisUserRepository } from "~/server/data/repositories/redisUserRepository";
import { redis } from "~/server/data/redis";
import type { User } from "~/server/data/types";

const userRepository = new RedisUserRepository(redis);

export const userRouter = createTRPCRouter({
  getCurrent: protectedProcedure
    .query(async ({ ctx }): Promise<User | null> => {
      // ctx.userId comes from the protectedProcedure context
      const clerkId = ctx.userId;
      if (!clerkId) {
        // This theoretically shouldn't happen in a protectedProcedure,
        // but it's good practice to check.
        console.error("Clerk ID not found in context for protected procedure.");
        return null;
      }
      
      console.log(`[userRouter.getCurrent] Fetching user by Clerk ID: ${clerkId}`)
      const user = await userRepository.findByClerkId(clerkId);
      if (!user) {
        console.warn(`[userRouter.getCurrent] No user found in repository for Clerk ID: ${clerkId}`);
      }
      return user;
    }),
    
  // Optional: Add a procedure to get by ID if needed later
  // getById: publicProcedure
  //   .input(z.string())
  //   .query(async ({ input }): Promise<User | null> => {
  //     return await userRepository.getById(input);
  //   }),
}); 