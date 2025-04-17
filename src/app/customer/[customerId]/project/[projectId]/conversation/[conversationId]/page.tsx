"use client"; // Needs to be client to use useTitle hook

import React, { useEffect } from 'react';
import { notFound, useParams } from "next/navigation"; // Import useParams
// Removed server api import as data fetching is moved to client
import { ConversationClient } from "./conversation-client";
import { useTitle } from "~/app/_components/app-layout"; // Removed AppLayout import
import { api } from "~/trpc/react"; // Import react api for potential title fetching

// No longer need params prop interface
// interface ConversationPageProps { ... }

// NOTE: This component fetches data server-side conceptually,
// but because we need useTitle hook, it's marked 'use client'.
// A more advanced pattern might involve a Server Component wrapper.
export default function ConversationPage() {
  const { setTitle } = useTitle();
  const params = useParams(); // Get params using the hook
  
  // Ensure conversationId is a string
  const conversationId = typeof params.conversationId === 'string' ? params.conversationId : undefined;

  // Optionally fetch conversation details here just for the title
  // Or let ConversationClient handle everything
  const { data: conversation } = api.conversation.getById.useQuery(
    conversationId ?? "",
    { 
      enabled: !!conversationId, 
      staleTime: 5 * 60 * 1000, // Cache title for 5 mins
      select: (data) => ({ title: data?.title }) // Only select the title
    } 
  );

  useEffect(() => {
    if (conversation?.title) {
      setTitle(conversation.title);
    } else if (conversationId) {
      setTitle(`Conversation ...${conversationId.slice(-4)}`); // Fallback title while loading
    } else {
      setTitle("Conversation");
    }
  }, [conversationId, conversation?.title, setTitle]);

  if (!conversationId) {
    // Although useParams might return undefined/[], direct navigation should ensure it exists
    // If somehow we get here without an ID, trigger notFound
    return notFound();
  }

  // Render the client component, passing the validated ID
  // AppLayout is provided by the parent layout
  return <ConversationClient conversationId={conversationId} />;
} 