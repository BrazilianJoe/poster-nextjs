import type {
    User, UserData, UserRole,
    Subscription, SubscriptionData,
    Customer, CustomerData, CustomerAccess,
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
  delete(userId: string): Promise<void>;
}

export interface ISubscriptionRepository {
  create(data: SubscriptionData): Promise<Subscription>; // Return created sub with ID
  getById(subscriptionId: string): Promise<Subscription | null>;
  findByUserId(userId: string): Promise<Subscription | null>;
  update(subscriptionId: string, data: Partial<SubscriptionData>): Promise<void>;
  delete(subscriptionId: string): Promise<void>;
}

export interface ICustomerRepository {
  create(data: CustomerData): Promise<Customer>;
  getById(customerId: string): Promise<Customer | null>;
  update(customerId: string, data: Partial<CustomerData>): Promise<Customer>;
  delete(customerId: string): Promise<void>;
  getPermissions(customerId: string): Promise<Record<string, UserRole>>;
  setPermission(customerId: string, userId: string, role: UserRole): Promise<void>;
  removePermission(customerId: string, userId: string): Promise<void>;
  setOwner(customerId: string, newOwnerUserId: string): Promise<void>;
  listUserCustomers(userId: string): Promise<CustomerAccess[]>;
  listUserCustomersWithDetails(userId: string): Promise<(Customer & { role: UserRole })[]>;
  addProject(customerId: string, projectId: string): Promise<void>;
  removeProject(customerId: string, projectId: string): Promise<void>;
  getProjectIds(customerId: string): Promise<string[]>;
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
  delete(projectId: string): Promise<void>;
  listByCustomer(customerId: string): Promise<Project[]>;
}

export interface IConversationRepository {
  create(data: ConversationData): Promise<Conversation>; // Thin wrapper for upsert
  getMetadataById(conversationId: string): Promise<Conversation | null>; // Gets the Hash data
  // updateMetadata removed, replaced by general update
  update(conversationId: string, data: Partial<ConversationData>): Promise<Conversation>; // General update method
  upsert(data: ConversationData, options?: { mode?: 'create' | 'update', conversationId?: string }): Promise<Conversation>; // Upsert method
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
  delete(conversationId: string): Promise<void>;
}

export interface IPostRepository {
  create(data: PostData): Promise<Post>; // Thin wrapper for upsert
  getById(postId: string): Promise<Post | null>;
  update(postId: string, data: Partial<Omit<PostData, 'projectId' | 'contentPieces'>>): Promise<Post>; // Thin wrapper for upsert, returns Post
  upsert(data: PostData, options?: { mode?: 'create' | 'update', postId?: string }): Promise<Post>; // Upsert method
  setContentPieces(postId: string, content: string[]): Promise<void>;
  // Image Prompts (using Set)
  addImagePrompt(postId: string, prompt: string): Promise<void>;
  removeImagePrompt(postId: string, prompt: string): Promise<void>;
  getImagePrompts(postId: string): Promise<string[]>;
  // Project Relationships
  getProjectId(postId: string): Promise<string | null>;
  // Conversation Relationships (0:n)
  addConversation(postId: string, conversationId: string): Promise<void>;
  removeConversation(postId: string, conversationId: string): Promise<void>;
  getConversationIds(postId: string): Promise<string[]>;
  delete(postId: string): Promise<void>;
}