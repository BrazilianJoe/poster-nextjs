import type {
    User, UserData, UserRole,
    Subscription, SubscriptionData,
    Customer, CustomerData,
    Project, ProjectData,
    Conversation, ConversationData, Message,
    Post, PostData
} from './types';

// --- Core Repositories ---

export interface ISuperuserRepository {
  isSuperuser(userId: string): Promise<boolean>;
  addSuperuser(userId: string): Promise<void>;
  removeSuperuser(userId: string): Promise<void>;
}

export interface IUserRepository {
  upsert(data: UserData, mode?: 'create' | 'update'): Promise<User>; // Core function with optional mode
  create(data: UserData): Promise<User>; // Thin wrapper for upsert with 'create' mode
  getById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(userId: string, data: Partial<UserData>): Promise<void>; // Thin wrapper for upsert with 'update' mode
  setSubscriptionId(userId: string, subscriptionId: string | null): Promise<void>;
}

export interface ISubscriptionRepository {
  create(data: SubscriptionData): Promise<Subscription>; // Return created sub with ID
  getById(subscriptionId: string): Promise<Subscription | null>;
  findByUserId(userId: string): Promise<Subscription | null>;
  update(subscriptionId: string, data: Partial<SubscriptionData>): Promise<void>;
}

export interface ICustomerRepository {
  create(data: CustomerData): Promise<Customer>; // Return created customer with ID
  getById(customerId: string): Promise<Customer | null>;
  updateBasicInfo(customerId: string, data: Partial<{ name: string; industry: string; }>): Promise<void>;
  updateAiContext(customerId: string, context: Record<string, any>): Promise<void>;
  getAiContext(customerId: string): Promise<Record<string, any> | null>;
  setOwner(customerId: string, ownerUserId: string): Promise<void>;
  getOwnerUserId(customerId: string): Promise<string | null>;
  // Project Relationships
  addProject(customerId: string, projectId: string): Promise<void>;
  removeProject(customerId: string, projectId: string): Promise<void>;
  getProjectIds(customerId: string): Promise<string[]>;
  // Permissions
  getPermissions(customerId: string): Promise<Record<string, UserRole>>; // Map: userId -> role
  setPermission(customerId: string, userId: string, role: UserRole): Promise<void>;
  removePermission(customerId: string, userId: string): Promise<void>;
  getPermissionForUser(customerId: string, userId: string): Promise<UserRole | null>;
  // Updated upsert signature to match implementation requirements
  upsert(data: CustomerData, options?: { mode?: 'create' | 'update', customerId?: string }): Promise<Customer>;
}

export interface IProjectRepository {
  create(data: ProjectData): Promise<Project>; // Return created project with ID
  getById(projectId: string): Promise<Project | null>;
  updateBasicInfo(projectId: string, data: Partial<{ name: string; objective: string; }>): Promise<void>;
  updateAiContext(projectId: string, context: Record<string, any>): Promise<void>;
  getAiContext(projectId: string): Promise<Record<string, any> | null>;
  setCustomer(projectId: string, customerId: string): Promise<void>;
  getCustomerId(projectId: string): Promise<string | null>;
  // Conversation Relationships
  addConversation(projectId: string, conversationId: string): Promise<void>;
  removeConversation(projectId: string, conversationId: string): Promise<void>;
  getConversationIds(projectId: string): Promise<string[]>;
  // Add general update method
  update(projectId: string, data: Partial<ProjectData>): Promise<Project>;
  // Add upsert method mirroring ICustomerRepository
  upsert(data: ProjectData, options?: { mode?: 'create' | 'update', projectId?: string }): Promise<Project>;
}

export interface IConversationRepository {
  create(data: ConversationData): Promise<Conversation>; // Return created convo with ID
  getMetadataById(conversationId: string): Promise<Conversation | null>; // Gets the Hash data
  updateMetadata(conversationId: string, data: Partial<Omit<ConversationData, 'projectId'>>): Promise<void>;
  setProject(conversationId: string, projectId: string): Promise<void>;
  getProjectId(conversationId: string): Promise<string | null>;
  // Messages (using List)
  addMessage(conversationId: string, message: Message): Promise<void>;
  getMessages(conversationId: string, start?: number, end?: number): Promise<Message[]>; // Default: all
  getRecentMessages(conversationId: string, count: number): Promise<Message[]>;
  // Post Relationships
  addPost(conversationId: string, postId: string): Promise<void>;
  removePost(conversationId: string, postId: string): Promise<void>;
  getPostIds(conversationId: string): Promise<string[]>;
}

export interface IPostRepository {
  create(data: PostData): Promise<Post>; // Return created post with ID
  getById(postId: string): Promise<Post | null>;
  update(postId: string, data: Partial<Omit<PostData, 'conversationId' | 'imagePrompts' | 'contentPieces'>>): Promise<void>;
  setContentPieces(postId: string, content: string[]): Promise<void>;
  // Image Prompts (using Set)
  addImagePrompt(postId: string, prompt: string): Promise<void>;
  removeImagePrompt(postId: string, prompt: string): Promise<void>;
  getImagePrompts(postId: string): Promise<string[]>;
  getConversationId(postId: string): Promise<string | null>;
}