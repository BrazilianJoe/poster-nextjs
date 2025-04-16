import { notFound } from "next/navigation";
import { api } from "~/trpc/server";
import { ConversationClient } from "./conversation-client";
import { AppLayout } from "~/app/_components/app-layout";

// This is a Next.js server component that fetches the conversation data
export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  // Ensure params is fully resolved before using it
  const id = params?.id;
  
  if (!id) {
    return notFound();
  }
  
  try {
    // Try to get the conversation metadata - if it fails, the conversation doesn't exist
    const conversation = await api.conversation.getById(id);
    
    if (!conversation) {
      return notFound();
    }
    
    // Since the conversation exists, let's get its messages
    const messages = await api.conversation.getMessages(id);
    
    // Render the client component with the fetched data
    return (
      <AppLayout title={conversation.title}>
        <ConversationClient 
          conversation={conversation} 
          initialMessages={messages}
        />
      </AppLayout>
    );
  } catch (error) {
    console.error("Error loading conversation:", error);
    return (
      <AppLayout title="Error">
        <div className="flex h-full items-center justify-center">
          <div className="rounded-md bg-destructive/10 p-4 text-destructive">
            Error loading conversation. Please try again.
          </div>
        </div>
      </AppLayout>
    );
  }
} 