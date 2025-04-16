import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"
import { RedisConversationRepository } from "~/server/data/repositories/redisConversationRepository"
import { RedisProjectRepository } from "~/server/data/repositories/redisProjectRepository"
import { redis } from "~/server/data/redis"
import type { Conversation, Message } from "~/server/data/types"
import { z } from "zod"

const conversationRepository = new RedisConversationRepository(redis)
const projectRepository = new RedisProjectRepository(redis)

async function inspectRedisKeys(pattern: string) {
  const keys = await redis.keys(pattern)
  console.log(`Found keys matching ${pattern}:`, keys)
  
  for (const key of keys) {
    const type = await redis.type(key)
    console.log(`Key ${key} type:`, type)
    
    if (type === 'set') {
      const members = await redis.smembers(key)
      console.log(`Set ${key} members:`, members)
    } else if (type === 'hash') {
      const hash = await redis.hgetall(key)
      console.log(`Hash ${key} data:`, hash)
    }
  }
}

async function createConversation(data: { title: string; projectId: string; timestamp: string }) {
  // Create the conversation
  const conversation = await conversationRepository.create(data)
  
  // Add the conversation to the project's set
  await projectRepository.addConversation(data.projectId, conversation.id)
  
  return conversation
}

export const conversationRouter = createTRPCRouter({
  create: publicProcedure
    .input(z.object({
      title: z.string(),
      projectId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const conversation = await conversationRepository.create({
        title: input.title,
        projectId: input.projectId,
      })

      // Add the conversation to the project's set
      await projectRepository.addConversation(input.projectId, conversation.id)

      return conversation
    }),

  list: publicProcedure
    .input(z.string())
    .query(async ({ input: projectId }) => {
      const conversationIds = await projectRepository.getConversationIds(projectId)
      const conversations = await Promise.all(
        conversationIds.map((id) => conversationRepository.getMetadataById(id))
      )
      return conversations.filter((c): c is Conversation => c !== null)
    }),

  // Get a conversation by ID
  getById: publicProcedure
    .input(z.string())
    .query(async ({ input: conversationId }) => {
      return await conversationRepository.getById(conversationId)
    }),

  // Get messages for a conversation
  getMessages: publicProcedure
    .input(z.string())
    .query(async ({ input: conversationId }) => {
      return await conversationRepository.getMessages(conversationId)
    }),

  // Add a message to a conversation
  addMessage: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      message: z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        timestamp: z.string(),
        authorId: z.string(),
      }),
    }))
    .mutation(async ({ input }) => {
      await conversationRepository.addMessage(input.conversationId, input.message)
      
      // Return all messages for the conversation
      return await conversationRepository.getMessages(input.conversationId)
    }),
}) 