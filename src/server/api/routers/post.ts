import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { RedisPostRepository } from "~/server/data/repositories/redisPostRepository";
import { RedisProjectRepository } from "~/server/data/repositories/redisProjectRepository";
import { RedisCustomerRepository } from "~/server/data/repositories/redisCustomerRepository";
import { RedisUserRepository } from "~/server/data/repositories/redisUserRepository";
import { redis } from "~/server/data/redis";
import type { Post as PostType } from "~/server/data/types";
import { TRPCError } from "@trpc/server";

const postRepository = new RedisPostRepository(redis);
const projectRepository = new RedisProjectRepository(redis);
const customerRepository = new RedisCustomerRepository(redis);
const userRepository = new RedisUserRepository(redis);

// Mocked DB
interface Post {
  id: number;
  name: string;
}
const posts: Post[] = [
  {
    id: 1,
    name: "Hello World",
  },
];

export const postRouter = createTRPCRouter({
  hello: protectedProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      targetPlatform: z.string(),
      postType: z.string(),
      contentPieces: z.array(z.string()),
      mediaLinks: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to create posts'
        });
      }

      // Find internal user ID using Clerk ID
      const user = await userRepository.findByClerkId(ctx.userId);
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found in system'
        });
      }

      // Get project to verify customer access
      const project = await projectRepository.getById(input.projectId);
      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found'
        });
      }

      // Verify user has access to the customer
      const customerAccess = await customerRepository.listUserCustomers(user.id);
      const hasAccess = customerAccess.some(c => c.customerId === project.customerId);
      
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have permission to create posts in this project"
        });
      }

      try {
        // Create the post
        const post = await postRepository.create({
          projectId: input.projectId,
          targetPlatform: input.targetPlatform,
          postType: input.postType,
          contentPieces: input.contentPieces,
          mediaLinks: input.mediaLinks || [],
        });

        // Add the post to the project's set
        await projectRepository.addPost(input.projectId, post.id);
        console.log(`Created post ${post.id} and added it to project ${input.projectId}`);
        
        return post;
      } catch (error) {
        console.error('Error creating post:', error);
        throw error;
      }
    }),

  getLatest: protectedProcedure.query(() => {
    return null;
  }),

  list: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input: projectId }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to list posts'
        });
      }

      // Find internal user ID using Clerk ID
      const user = await userRepository.findByClerkId(ctx.userId);
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found in system'
        });
      }

      // Get project to verify customer access
      const project = await projectRepository.getById(projectId);
      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found'
        });
      }

      // Verify user has access to the customer
      const customerAccess = await customerRepository.listUserCustomers(user.id);
      const hasAccess = customerAccess.some(c => c.customerId === project.customerId);
      
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have permission to view posts in this project"
        });
      }

      const postIds = await projectRepository.getPostIds(projectId);
      const posts = await Promise.all(
        postIds.map((id) => postRepository.getById(id))
      );
      return posts.filter((p): p is PostType => p !== null);
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input: postId }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to view posts'
        });
      }

      // Find internal user ID using Clerk ID
      const user = await userRepository.findByClerkId(ctx.userId);
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not found in system'
        });
      }

      // Get post to verify project access
      const post = await postRepository.getById(postId);
      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found'
        });
      }

      // Get project to verify customer access
      const project = await projectRepository.getById(post.projectId);
      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found'
        });
      }

      // Verify user has access to the customer
      const customerAccess = await customerRepository.listUserCustomers(user.id);
      const hasAccess = customerAccess.some(c => c.customerId === project.customerId);
      
      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have permission to view this post"
        });
      }

      return post;
    }),
});
