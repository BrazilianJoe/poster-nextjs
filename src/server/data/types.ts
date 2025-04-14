// ===== User Types =====
export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

/**
 * Represents a user in the system
 */
export interface User {
    id: string;
    email: string;
    name: string;
    clerkId: string;
    subscriptionId?: string | null;
}

/**
 * Data required to create or update a user
 */
export interface UserData {
    email: string;
    name: string;
    clerkId: string;
    subscriptionId?: string | null;
}

// ===== Subscription Types =====
/**
 * Represents a user's subscription plan
 */
export interface Subscription {
    id: string;
    userId: string;
    planType: string;
    status: string;
}

/**
 * Data required to create or update a subscription
 */
export interface SubscriptionData {
    userId: string;
    planType: string;
    status: string;
}

// ===== Customer Types =====
/**
 * Data required to create or update a customer
 */
export type CustomerData = {
    name: string;
    ownerUserId: string;
    industry?: string;
    aiContext?: Record<string, any>;
};

/**
 * Represents a customer/client in the system
 */
export type Customer = CustomerData & {
    id: string;
    permissions: Record<string, UserRole>;
};

/**
 * Represents a user's access to a customer
 */
export type CustomerAccess = {
    customerId: string;
    role: UserRole;
};

// ===== Project Types =====
/**
 * Represents a project associated with a customer
 */
export interface Project {
    id: string;
    name: string;
    customerId: string;
    objective?: string;
    aiContext?: Record<string, any>;
}

/**
 * Data required to create or update a project
 */
export interface ProjectData {
    name: string;
    customerId: string;
    objective?: string;
    aiContext?: Record<string, any>;
}

// ===== Conversation Types =====
/**
 * Represents a conversation thread within a project
 */
export interface Conversation {
    id: string;
    projectId: string;
    title: string;
}

/**
 * Data required to create or update a conversation
 */
export interface ConversationData {
    projectId: string;
    title: string;
}

/**
 * Represents a message in a conversation
 */
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    authorId: string;
}

// ===== Post Types =====
/**
 * Represents a social media post or content piece
 */
export interface Post {
    id: string;
    projectId: string;
    targetPlatform: string;
    postType: string;
    mediaLinks: string[];
    contentPieces: string[];
}

/**
 * Data required to create or update a post
 */
export interface PostData {
    projectId: string;
    targetPlatform: string;
    postType: string;
    mediaLinks: string[];
    contentPieces: string[];
}