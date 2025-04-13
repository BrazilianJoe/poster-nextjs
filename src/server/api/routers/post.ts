import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { RedisPostRepository } from "~/server/data/repositories/redisPostRepository";
import { RedisProjectRepository } from "~/server/data/repositories/redisProjectRepository";
import { redis } from "~/server/data/redis";
import type { Post as PostType } from "~/server/data/types";

const postRepository = new RedisPostRepository(redis);
const projectRepository = new RedisProjectRepository(redis);

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
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: publicProcedure
    .input(z.object({
      projectId: z.string(),
      targetPlatform: z.string(),
      postType: z.string(),
      contentPieces: z.array(z.string()),
      mediaLinks: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
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

  getLatest: publicProcedure.query(() => {
    return posts.at(-1) ?? null;
  }),

  list: publicProcedure
    .input(z.string())
    .query(async ({ input: projectId }) => {
      try {
        // Get all post IDs for the project using the project repository
        const postIds = await projectRepository.getPostIds(projectId);
        console.log(`Found ${postIds.length} post IDs for project ${projectId}:`, postIds);
        
        if (postIds.length === 0) {
          return [];
        }

        // Get metadata for each post using the post repository
        const posts = await Promise.all(
          postIds.map(async (id) => {
            const post = await postRepository.getById(id);
            if (!post) {
              console.warn(`Post ${id} not found, but was in project's post set`);
              return null;
            }
            return post;
          })
        );

        // Filter out null values and ensure type safety
        const validPosts = posts.filter((post): post is PostType => 
          post !== null && 
          typeof post.projectId === 'string' &&
          typeof post.targetPlatform === 'string' &&
          typeof post.postType === 'string' &&
          Array.isArray(post.mediaLinks) &&
          Array.isArray(post.contentPieces)
        );
        console.log(`Found ${validPosts.length} valid posts for project ${projectId}`);
        return validPosts;
      } catch (error) {
        console.error(`Error listing posts for project ${projectId}:`, error);
        throw error;
      }
    }),

  getById: publicProcedure
    .input(z.string())
    .query(async ({ input: postId }) => {
      try {
        const post = await postRepository.getById(postId);
        if (!post) {
          throw new Error(`Post with ID ${postId} not found`);
        }
        return post;
      } catch (error) {
        console.error(`Error getting post ${postId}:`, error);
        throw error;
      }
    }),
});
