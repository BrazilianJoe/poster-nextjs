export class RedisKeys {
    private readonly namespace: string;
    private readonly separator = ':';

    constructor(namespace: string = '') {
        this.namespace = namespace;
    }

    // Base keys
    customer(id: string): string {
        return this.join('cust', id);
    }

    project(id: string): string {
        return this.join('proj', id);
    }

    conversation(id: string): string {
        return this.join('conv', id);
    }

    post(id: string): string {
        return this.join('post', id);
    }

    user(id: string): string {
        return this.join('user', id);
    }

    subscription(id: string): string {
        return this.join('sub', id);
    }

    // Related keys
    customerPermissions(customerId: string): string {
        return this.join('cust', customerId, 'permissions');
    }

    customerProjects(customerId: string): string {
        return this.join('cust', customerId, 'projects');
    }

    userCustomers(userId: string): string {
        return this.join('user', userId, 'customers');
    }

    projectConversations(projectId: string): string {
        return this.join('proj', projectId, 'conversations');
    }

    projectPosts(projectId: string): string {
        return this.join('proj', projectId, 'posts');
    }

    conversationPosts(conversationId: string): string {
        return this.join('conv', conversationId, 'posts');
    }

    postConversations(postId: string): string {
        return this.join('post', postId, 'conversations');
    }

    postMediaLinks(postId: string): string {
        return this.join('post', postId, 'media');
    }

    userSubscription(userId: string): string {
        return this.join('user', userId, 'subscription');
    }

    // Helper method
    private join(...parts: string[]): string {
        return [this.namespace, ...parts].filter(Boolean).join(this.separator);
    }
} 