import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"
import { RedisProjectRepository } from "~/server/data/repositories/redisProjectRepository"
import { redis } from "~/server/data/redis"
import type { Project } from "~/server/data/types"
import { z } from "zod"

const projectRepository = new RedisProjectRepository(redis)

export const projectRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.string().optional())
    .query(async ({ input: customerId }) => {
      // If no customer ID is provided, return all projects
      if (!customerId) {
        const projects = await Promise.all(
          (await redis.keys("proj:*"))
            .filter((key: string) => !key.includes(":conversations") && !key.includes(":posts"))
            .map((key: string) => projectRepository.getById(key.replace("proj:", "")))
        )
        return projects.filter((project: Project | null): project is Project => project !== null)
      }

      // If customer ID is provided, only return projects for that customer
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