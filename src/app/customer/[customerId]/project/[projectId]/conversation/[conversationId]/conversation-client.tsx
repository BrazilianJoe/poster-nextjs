"use client";

import React, { useState, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import type { Conversation, Message } from "~/server/data/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Send, UserCircle, Bot, Loader2 } from "lucide-react"; // Added Loader2
import { Skeleton } from "~/components/ui/skeleton";
import type { TRPCClientError } from "@trpc/client";

// Helper to format message timestamp
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

interface ConversationClientProps {
  conversationId: string;
}

export function ConversationClient({ conversationId }: ConversationClientProps) {
  const [newMessage, setNewMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();

  // Fetch conversation metadata
  const { data: conversation, isLoading: isLoadingConversation, error: conversationError } = 
    api.conversation.getById.useQuery(conversationId);

  // Fetch messages for the conversation
  const { data: messages = [], isLoading: isLoadingMessages, error: messagesError } = 
    api.conversation.getMessages.useQuery(conversationId);

  // Mutation for adding a new message
  const addMessageMutation = api.conversation.addMessage.useMutation({
    onSuccess: () => {
      // Invalidate messages query to refetch
      utils.conversation.getMessages.invalidate(conversationId);
      setNewMessage("");
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      // TODO: Show user feedback (e.g., toast notification)
      setIsSubmitting(false);
      // Optional: Revert optimistic update if implemented
    },
    // Optional: Optimistic Update (more advanced)
    // onMutate: async (newMessageData) => { ... }
    // onError: (err, newMessageData, context) => { ... }
    // onSettled: () => { ... }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSubmitting || !conversationId) return;

    setIsSubmitting(true);
    const messageInput: Message = {
      role: "user",
      content: newMessage,
      timestamp: new Date().toISOString(),
      authorId: "current-user", // Replace with actual user ID from Clerk context if needed
    };

    // Send to API
    addMessageMutation.mutate({
      conversationId: conversationId,
      message: messageInput
    });
  };

  // --- Loading and Error States --- 
  if (isLoadingConversation || isLoadingMessages) {
    return (
      <div className="flex h-full flex-col p-2 md:p-4 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground mt-2">Loading conversation...</p>
      </div>
    );
  }

  if (conversationError || messagesError || !conversation) {
    return (
      <div className="flex h-full flex-col p-2 md:p-4 items-center justify-center">
         <p className="text-destructive">
           Error loading conversation: {conversationError?.message || messagesError?.message || 'Conversation not found.'}
        </p>
      </div>
    );
  }

  // --- Render Conversation --- 
  return (
    <div className="flex h-full flex-col pt-2 px-2 pb-0 md:pt-4 md:px-4 md:pb-0">
      <Card className="flex h-full flex-col rounded-lg rounded-b-none shadow-md">
        {/* Header uses fetched conversation data */}
        <CardHeader className="border-b bg-muted/20 px-3 py-2 md:px-4 md:py-3">
          <CardTitle className="text-lg font-medium">
            {conversation.title} 
          </CardTitle>
        </CardHeader>
        {/* Content uses fetched messages data */}
        <CardContent className="flex-1 overflow-y-auto p-2 md:p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex justify-center p-6">
                <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={`${message.timestamp}-${index}`} // Use a more robust key
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div 
                    className={`
                      flex max-w-[80%] items-start gap-2 rounded-lg px-4 py-2
                      ${message.role === "user" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                      }
                    `}
                  >
                    <div className="mt-1">
                      {message.role === "user" ? (
                        <UserCircle className="h-5 w-5" />
                      ) : (
                        <Bot className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="break-words">{message.content}</div>
                      <div className="text-right text-xs opacity-70">
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
        {/* Footer remains the same */}
        <CardFooter className="p-4">
          <div className="w-full p-3 bg-background border rounded-lg shadow-sm">
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isSubmitting}
                className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button type="submit" disabled={addMessageMutation.isPending || !newMessage.trim()}>
                {addMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 