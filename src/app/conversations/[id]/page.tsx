import { notFound } from "next/navigation";
import { api } from "~/trpc/server";
import { ConversationClient } from "./conversation-client";
import { AppLayout } from "~/app/_components/app-layout";

export const dynamic = 'force-dynamic';

// Generate metadata for the page
export async function generateMetadata({ params }: { params: { id: string } }) {
  const id = params.id;
  
  try {
    const conversation = await api.conversation.getById(id);
    return {
      title: conversation?.title || "Conversation"
    };
  } catch (error) {
    return {
      title: "Conversation Not Found"
    };
  }
}

// This is a Next.js server component that fetches the conversation data
export default function Page(props: { params: { id: string } }) {
  async function getContent() {
    try {
      // Get the ID from params
      const id = props.params.id;
      
      // Try to get the conversation metadata - if it fails, the conversation doesn't exist
      const conversation = await api.conversation.getById(id);
      
      if (!conversation) {
        return notFound();
      }
      
      // Since the conversation exists, let's get its messages
      const messages = await api.conversation.getMessages(id);
      
      // Return the data
      return { conversation, messages };
    } catch (error) {
      console.error("Error loading conversation:", error);
      return null;
    }
  }

  // Use the async function to render content
  const content = getContent();
  
  return content.then(data => {
    if (!data) {
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
    
    return (
      <AppLayout title={data.conversation.title}>
        <ConversationClient 
          conversation={data.conversation} 
          initialMessages={data.messages}
        />
      </AppLayout>
    );
  });
} 