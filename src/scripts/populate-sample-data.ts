import { RedisConversationRepository } from "~/server/data/repositories/redisConversationRepository"
import { RedisPostRepository } from "~/server/data/repositories/redisPostRepository"
import { RedisProjectRepository } from "~/server/data/repositories/redisProjectRepository"
import { RedisCustomerRepository } from "~/server/data/repositories/redisCustomerRepository"
import { redis } from "~/server/data/redis"
import { v4 as uuidv4 } from "uuid"

async function main() {
  const conversationRepository = new RedisConversationRepository(redis)
  const postRepository = new RedisPostRepository(redis)
  const projectRepository = new RedisProjectRepository(redis)
  const customerRepository = new RedisCustomerRepository(redis)

  // Create or update a customer
  const customer = await customerRepository.upsert({
    name: "Acme Corp",
    ownerUserId: "user-1",
    industry: "Technology",
  })

  // Create or update a project for the customer
  const project = await projectRepository.upsert({
    name: "Social Media Campaign",
    customerId: customer.id,
    objective: "Q2 social media marketing campaign",
  })

  // Create or update conversations for the project
  const conversation1 = await conversationRepository.upsert({
    title: "Campaign Strategy Discussion",
    projectId: project.id,
  })

  const conversation2 = await conversationRepository.upsert({
    title: "Content Planning",
    projectId: project.id,
  })

  // Add conversations to the project's set
  await projectRepository.addConversation(project.id, conversation1.id)
  await projectRepository.addConversation(project.id, conversation2.id)

  // Create or update posts for the first conversation
  const post1 = await postRepository.upsert({
    conversationId: conversation1.id,
    targetPlatform: "twitter",
    postType: "announcement",
    contentPieces: ["We're excited to announce our new product!"],
  })

  const post2 = await postRepository.upsert({
    conversationId: conversation1.id,
    targetPlatform: "instagram",
    postType: "teaser",
    contentPieces: ["Something amazing is coming..."],
  })

  // Add posts to the conversation's set
  await conversationRepository.addPost(conversation1.id, post1.id)
  await conversationRepository.addPost(conversation1.id, post2.id)

  // Create or update a post for the second conversation
  const post3 = await postRepository.upsert({
    conversationId: conversation2.id,
    targetPlatform: "linkedin",
    postType: "planning",
    contentPieces: ["Our content plan for the next month"],
  })

  // Add post to the conversation's set
  await conversationRepository.addPost(conversation2.id, post3.id)

  console.log("Sample data populated successfully!")
  console.log("Customer:", customer)
  console.log("Project:", project)
  console.log("Conversations:", [conversation1, conversation2])
  console.log("Posts:", [post1, post2, post3])
}

main().catch((error) => {
  console.error("Error populating sample data:", error)
  process.exit(1)
}) 