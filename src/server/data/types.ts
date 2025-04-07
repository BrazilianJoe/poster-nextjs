// Placeholder Types (adjust as needed)
export type UserRole = "owner" | "admin" | "editor" | "viewer";

export interface User { id: string; email: string; name: string; subscriptionId?: string | null; }
export interface UserData { email: string; name: string; subscriptionId?: string | null; } // Data for creation/update

export interface Subscription { id: string; userId: string; planType: string; status: string; }
export interface SubscriptionData { userId: string; planType: string; status: string; }

export interface Customer { id: string; name: string; ownerUserId: string; industry?: string; aiContext?: Record<string, any>; }
export interface CustomerData { name: string; ownerUserId: string; industry?: string; aiContext?: Record<string, any>; }

export interface Project { id: string; name: string; customerId: string; objective?: string; aiContext?: Record<string, any>; }
export interface ProjectData { name: string; customerId: string; objective?: string; aiContext?: Record<string, any>; }

export interface Conversation { id: string; title: string; projectId: string; timestamp: string; }
export interface ConversationData { title: string; projectId: string; timestamp: string; }

export interface Message { role: "user" | "assistant" | "system"; content: string; timestamp?: string; } // Added timestamp

export interface Post { id: string; conversationId: string; targetPlatform: string; postType: string; imageLink?: string | null; contentPieces: string[]; }
export interface PostData { conversationId: string; targetPlatform: string; postType: string; imageLink?: string | null; contentPieces: string[]; }