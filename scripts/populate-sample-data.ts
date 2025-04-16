import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import { RedisCustomerRepository } from '~/server/data/repositories/redisCustomerRepository';
import { RedisProjectRepository } from '~/server/data/repositories/redisProjectRepository';
import { RedisConversationRepository } from '~/server/data/repositories/redisConversationRepository';
import { RedisPostRepository } from '~/server/data/repositories/redisPostRepository';
import { RedisUserRepository } from '~/server/data/repositories/redisUserRepository';
import { RedisSubscriptionRepository } from '~/server/data/repositories/redisSubscriptionRepository';
import { RedisPurge } from '../src/server/data/repositories/redisPurge';
import type { User, UserData, Subscription, Customer, Project, Conversation, Post, Message } from '../src/server/data/types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Redis client with production credentials
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Initialize repositories
const userRepo = new RedisUserRepository(redis);
const subscriptionRepo = new RedisSubscriptionRepository(redis);
const customerRepo = new RedisCustomerRepository(redis);
const projectRepo = new RedisProjectRepository(redis);
const conversationRepo = new RedisConversationRepository(redis);
const postRepo = new RedisPostRepository(redis);
const redisPurge = new RedisPurge(redis);

// Sample user data
const sampleUser: UserData = {
  email: "tiago.freire@gmail.com",
  name: "Tiago",
  clerkId: "user_2vOv2LJCwtB2n4u1oAyu37dqAXf",
};

// Sample subscription data
const sampleSubscription = {
  userId: '', // Will be set after user creation
  planType: 'pro',
  status: 'active',
};

// Sample data
const sampleCustomers = [
  {
    name: 'TechCorp Inc.',
    ownerUserId: '', // Will be set after user creation
    industry: 'Technology',
    aiContext: {
      companyDescription: 'A leading technology company specializing in AI solutions',
      targetAudience: 'Tech-savvy professionals and businesses',
      brandVoice: 'Innovative, professional, and forward-thinking',
    },
  },
  {
    name: 'GreenLife Foods',
    ownerUserId: '', // Will be set after user creation
    industry: 'Food & Beverage',
    aiContext: {
      companyDescription: 'Organic food company committed to sustainable practices',
      targetAudience: 'Health-conscious consumers and eco-friendly businesses',
      brandVoice: 'Natural, friendly, and environmentally conscious',
    },
  },
];

const sampleProjects = [
  {
    name: 'AI Product Launch',
    customerId: '', // Will be set after customer creation
    objective: 'Marketing campaign for new AI product line',
  },
  {
    name: 'Sustainability Initiative',
    customerId: '', // Will be set after customer creation
    objective: 'Promoting eco-friendly practices and products',
  },
];

const sampleConversations = [
  {
    title: 'Product Launch Strategy',
    projectId: '', // Will be set after project creation
    timestamp: Date.now().toString(),
  },
  {
    title: 'Sustainability Campaign',
    projectId: '', // Will be set after project creation
    timestamp: Date.now().toString(),
  },
];

const samplePosts = [
  {
    projectId: '', // Will be set after project creation
    targetPlatform: 'twitter',
    postType: 'announcement',
    contentPieces: [
      '🚀 Exciting news! We\'re launching our new AI-powered solution that\'s set to revolutionize the industry.',
      'Our latest innovation combines cutting-edge machine learning with intuitive design, making complex tasks simple.',
      'Join us on this journey as we push the boundaries of what\'s possible with AI. #Innovation #AI',
    ],
    mediaLinks: [
      'https://example.com/ai-product-image.jpg',
      'https://example.com/ai-demo-video.mp4',
    ],
  },
  {
    projectId: '', // Will be set after project creation
    targetPlatform: 'linkedin',
    postType: 'article',
    contentPieces: [
      'At GreenLife Foods, we believe in sustainable practices that benefit both people and the planet.',
      'Our commitment to organic farming and eco-friendly packaging is just the beginning.',
      'Join us in making a difference, one sustainable choice at a time.',
    ],
    mediaLinks: [
      'https://example.com/sustainable-farming.jpg',
      'https://example.com/eco-packaging.jpg',
    ],
  },
];

async function clearSampleData() {
  try {
    console.log('Cleaning up all test data...');
    
    // First, get all keys to see what we're dealing with
    const allKeys = await redis.keys('*');
    console.log('Found keys:', allKeys);

    // Clean up using redisPurge
    await redisPurge.purgeTestData();
    
    // Double check for any remaining keys
    const remainingKeys = await redis.keys('*');
    if (remainingKeys.length > 0) {
      console.log('Found remaining keys after purge:', remainingKeys);
      
      // Additional cleanup for specific patterns
      const patterns = [
        'user:*', 'user_email:*',
        'sub:*', 'sub_user:*',
        'cust:*', 'cust_user:*',
        'proj:*', 'proj_cust:*',
        'conv:*', 'conv_proj:*',
        'post:*', 'post_proj:*',
        '*:permissions', '*:projects', '*:conversations', '*:posts',
        '*:media', '*:subscription'
      ];
      
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          console.log(`Cleaning up ${keys.length} keys matching ${pattern}`);
          await Promise.all(keys.map(key => redis.del(key)));
        }
      }
    }
    
    // Final verification
    const finalKeys = await redis.keys('*');
    if (finalKeys.length > 0) {
      console.log('Warning: Some keys still remain after cleanup:', finalKeys);
    } else {
      console.log('All keys successfully cleaned up!');
    }
    
    console.log('Test data cleanup completed successfully!');
  } catch (error) {
    console.error('Error cleaning up sample data:', error);
    process.exit(1);
  }
}

async function createSampleData() {
  try {
    console.log('Starting to create sample data...');

    // Check if user exists
    let user = await userRepo.findByEmail(sampleUser.email);
    if (!user) {
      // Create new user if doesn't exist
      user = await userRepo.create(sampleUser);
      console.log(`Created user: ${user.name} (${user.email}) with ID: ${user.id}`);
    } else {
      // Update existing user with Clerk ID
      await userRepo.update(user.id, { clerkId: sampleUser.clerkId });
      const updatedUser = await userRepo.getById(user.id);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }
      user = updatedUser;
      console.log(`Updated existing user: ${user.name} (${user.email}) with Clerk ID: ${sampleUser.clerkId}`);
    }

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    // Handle subscription
    let subscription: Subscription;
    if (user.subscriptionId) {
      // Update existing subscription
      await subscriptionRepo.update(user.subscriptionId, {
        ...sampleSubscription,
        userId: user.id,
      });
      const updatedSubscription = await subscriptionRepo.getById(user.subscriptionId);
      if (!updatedSubscription) {
        throw new Error(`Failed to retrieve updated subscription for user: ${user.name}`);
      }
      subscription = updatedSubscription;
      console.log(`Updated subscription for user: ${user.name}`);
    } else {
      // Create new subscription
      subscription = await subscriptionRepo.create({
        ...sampleSubscription,
        userId: user.id,
      });
      console.log(`Created subscription for user: ${user.name}`);
      // Update user with subscription ID
      await userRepo.setSubscriptionId(user.id, subscription.id);
    }

    // Create or update customers
    const customers = await Promise.all(
      sampleCustomers.map(async (customerData) => {
        // Get existing customers for the user
        const existingCustomers = await customerRepo.listUserCustomersWithDetails(user.id);
        const existingCustomer = existingCustomers.find(c => c.name === customerData.name);
        
        if (existingCustomer) {
          // Update existing customer
          const customer = await customerRepo.update(existingCustomer.id, {
            ...customerData,
            ownerUserId: user.id,
          });
          console.log(`Updated customer: ${customer.name}`);
          return customer;
        } else {
          // Create new customer
          const customer = await customerRepo.create({
            ...customerData,
            ownerUserId: user.id,
          });
          console.log(`Created customer: ${customer.name}`);
          return customer;
        }
      })
    );

    // Create or update projects
    const projects = await Promise.all(
      customers.map(async (customer: Customer, index: number) => {
        const projectData = {
          name: sampleProjects[index]!.name,
          customerId: customer.id,
          objective: sampleProjects[index]!.objective,
        };
        
        // Get existing projects for this customer
        const existingProjects = await projectRepo.listByCustomer(customer.id);
        const existingProject = existingProjects.find(p => p.name === projectData.name);
        
        if (existingProject) {
          // Update existing project
          const project = await projectRepo.update(existingProject.id, projectData);
          console.log(`Updated project: ${project.name} for ${customer.name}`);
          return project;
        } else {
          // Create new project
          const project = await projectRepo.create(projectData);
          console.log(`Created project: ${project.name} for ${customer.name}`);
          return project;
        }
      })
    );

    // Create or update conversations for each project
    await Promise.all(
      projects.map(async (project: Project, index: number) => {
        const conversationData = {
          ...sampleConversations[index]!,
          projectId: project.id,
        };
        
        // Create new conversation
        const conversation = await conversationRepo.create(conversationData);
        console.log(`Created conversation: ${conversation.title} for project: ${project.name}`);
        // Add conversation to project's set
        await projectRepo.addConversation(project.id, conversation.id);
        return conversation;
      })
    );

    // Create or update posts for each project
    await Promise.all(
      projects.map(async (project: Project, index: number) => {
        const postData = {
          ...samplePosts[index]!,
          projectId: project.id,
        };
        
        const existingPost = await postRepo.getById(project.id);
        if (existingPost) {
          // Update existing post
          const post = await postRepo.upsert(postData, { mode: 'update', postId: existingPost.id });
          console.log(`Updated post for project: ${project.name}`);
          return post;
        } else {
          // Create new post
          const post = await postRepo.upsert(postData, { mode: 'create' });
          console.log(`Created post for project: ${project.name}`);
          // Add post to project's set
          await projectRepo.addPost(project.id, post.id);
          return post;
        }
      })
    );

    console.log('Sample data created successfully!');
  } catch (error) {
    console.error('Error creating sample data:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');
const shouldCreate = args.includes('--create');
const shouldForce = args.includes('--force');

// If no flags are provided, default to both clear and create
const defaultBehavior = !shouldClear && !shouldCreate && !shouldForce;

// Force cleanup function
async function forceCleanup() {
  try {
    // Check for existing user with sample email
    const existingUser = await userRepo.findByEmail(sampleUser.email);
    if (existingUser) {
      console.log(`Found existing user with email ${sampleUser.email}, cleaning up related data...`);
      
      // Clean up related data
      if (existingUser.subscriptionId) {
        await subscriptionRepo.delete(existingUser.subscriptionId);
        console.log(`Deleted subscription ${existingUser.subscriptionId}`);
      }
      
      // Get and clean up all customers owned by this user
      const customerAccess = await customerRepo.listUserCustomersWithDetails(existingUser.id);
      const ownedCustomers = customerAccess.filter(c => c.role === 'owner');
      
      for (const customer of ownedCustomers) {
        // Clean up projects
        const projects = await projectRepo.listByCustomer(customer.id);
        for (const project of projects) {
          // Clean up conversations
          const conversationIds = await projectRepo.getConversationIds(project.id);
          for (const conversationId of conversationIds) {
            await conversationRepo.delete(conversationId);
            console.log(`Deleted conversation ${conversationId}`);
          }
          
          // Clean up posts
          const postIds = await projectRepo.getPostIds(project.id);
          for (const postId of postIds) {
            await postRepo.delete(postId);
            console.log(`Deleted post ${postId}`);
          }
          
          await projectRepo.delete(project.id);
          console.log(`Deleted project ${project.id}`);
        }
        
        await customerRepo.delete(customer.id);
        console.log(`Deleted customer ${customer.id}`);
      }
      
      // Finally delete the user
      await userRepo.delete(existingUser.id);
      console.log(`Deleted user ${existingUser.id}`);
    } else {
      console.log('No existing sample user found, nothing to clean up');
    }
    
    console.log('Force cleanup completed');
  } catch (error) {
    console.error('Error during force cleanup:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    console.log('Starting script with flags:', { shouldClear, shouldCreate, shouldForce });
    
    // If force flag is present, run force cleanup first
    if (shouldForce) {
      await forceCleanup();
    }

    // Then proceed with normal cleanup if requested
    if (shouldClear || defaultBehavior) {
      await clearSampleData();
    }

    // Then create sample data if requested
    if (shouldCreate || defaultBehavior) {
      await createSampleData();
    }

    console.log('Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during script execution:', error);
    process.exit(1);
  }
}

// Run the main function
main();