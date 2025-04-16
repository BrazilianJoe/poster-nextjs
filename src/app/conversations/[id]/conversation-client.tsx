"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import type { Conversation, Message } from "~/server/data/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Send, UserCircle, Bot } from "lucide-react";
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

export function ConversationClient({
  conversation,
  initialMessages = [],
}: {
  conversation: Conversation;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addMessageMutation = api.conversation.addMessage.useMutation({
    onSuccess: (updatedMessages: Message[]) => {
      setMessages(updatedMessages);
      setNewMessage("");
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      setIsSubmitting(false);
    }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const message: Message = {
      role: "user",
      content: newMessage,
      timestamp: new Date().toISOString(),
      authorId: "current-user", // Replace with actual user ID if available
    };

    // Optimistically update UI
    setMessages([...messages, message]);
    setNewMessage("");

    // Send to API
    addMessageMutation.mutate({
      conversationId: conversation.id,
      message
    });
  };

  return (
    <div className="flex h-full flex-col pt-2 px-2 pb-0 md:pt-4 md:px-4 md:pb-0">
      <Card className="flex h-full flex-col rounded-lg rounded-b-none shadow-md">
        <CardHeader className="border-b bg-muted/20 px-3 py-2 md:px-4 md:py-3">
          <CardTitle className="text-lg font-medium">
            {conversation.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-2 md:p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex justify-center p-6">
                <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={index} 
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
              <Button type="submit" disabled={isSubmitting || !newMessage.trim()}>
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
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