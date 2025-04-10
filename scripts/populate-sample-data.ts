import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import { RedisCustomerRepository } from '~/server/data/repositories/redisCustomerRepository';
import { RedisProjectRepository } from '~/server/data/repositories/redisProjectRepository';
import { RedisConversationRepository } from '~/server/data/repositories/redisConversationRepository';
import { RedisPostRepository } from '~/server/data/repositories/redisPostRepository';
import { RedisUserRepository } from '~/server/data/repositories/redisUserRepository';
import { RedisSubscriptionRepository } from '~/server/data/repositories/redisSubscriptionRepository';

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

// Sample user data
const sampleUser = {
  email: 'tiago.freire@gmail.com',
  name: 'Tiago Freire',
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
    description: 'Marketing campaign for new AI product line',
  },
  {
    name: 'Sustainability Initiative',
    customerId: '', // Will be set after customer creation
    description: 'Promoting eco-friendly practices and products',
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
    conversationId: '', // Will be set after conversation creation
    targetPlatform: 'Twitter',
    postType: 'Thread',
    contentPieces: [
      '🚀 Exciting news! We\'re launching our new AI-powered solution that\'s set to revolutionize the industry.',
      'Our latest innovation combines cutting-edge machine learning with intuitive design, making complex tasks simple.',
      'Join us on this journey as we push the boundaries of what\'s possible with AI. #Innovation #AI',
    ],
    imageLink: 'https://example.com/ai-product.jpg',
  },
  {
    conversationId: '', // Will be set after conversation creation
    targetPlatform: 'LinkedIn',
    postType: 'Article',
    contentPieces: [
      'At GreenLife Foods, we believe in sustainable practices that benefit both people and the planet.',
      'Our commitment to organic farming and eco-friendly packaging is just the beginning.',
      'Join us in making a difference, one sustainable choice at a time.',
    ],
    imageLink: 'https://example.com/sustainability.jpg',
  },
];

async function populateSampleData() {
  try {
    console.log('Starting to populate sample data...');

    // Create user
    const user = await userRepo.create(sampleUser);
    console.log(`Created user: ${user.name} (${user.email})`);

    // Create subscription for the user
    const subscription = await subscriptionRepo.create({
      ...sampleSubscription,
      userId: user.id,
    });
    console.log(`Created subscription for user: ${user.name}`);

    // Update user with subscription ID
    await userRepo.setSubscriptionId(user.id, subscription.id);

    // Create customers with the user as owner
    const customers = await Promise.all(
      sampleCustomers.map(async (customerData) => {
        const customer = await customerRepo.create({
          ...customerData,
          ownerUserId: user.id,
        });
        console.log(`Created customer: ${customer.name}`);
        return customer;
      })
    );

    // Create projects for each customer
    const projects = await Promise.all(
      customers.map(async (customer, index) => {
        const projectData = {
          name: sampleProjects[index]!.name,
          customerId: customer.id,
          description: sampleProjects[index]!.description,
        };
        const project = await projectRepo.create(projectData);
        console.log(`Created project: ${project.name} for ${customer.name}`);
        return project;
      })
    );

    // Create conversations for each project
    const conversations = await Promise.all(
      projects.map(async (project, index) => {
        const conversationData = {
          title: sampleConversations[index]!.title,
          projectId: project.id,
          timestamp: sampleConversations[index]!.timestamp,
        };
        const conversation = await conversationRepo.create(conversationData);
        console.log(`Created conversation: ${conversation.title} for ${project.name}`);
        return conversation;
      })
    );

    // Create posts for each conversation
    await Promise.all(
      conversations.map(async (conversation, index) => {
        const postData = {
          conversationId: conversation.id,
          targetPlatform: samplePosts[index]!.targetPlatform,
          postType: samplePosts[index]!.postType,
          contentPieces: samplePosts[index]!.contentPieces,
          imageLink: samplePosts[index]!.imageLink,
        };
        const post = await postRepo.create(postData);
        console.log(`Created post for conversation: ${conversation.title}`);
        
        // Add post to conversation
        await conversationRepo.addPost(conversation.id, post.id);
        return post;
      })
    );

    console.log('Sample data population completed successfully!');
  } catch (error) {
    console.error('Error populating sample data:', error);
  }
}

// Run the script
populateSampleData(); 