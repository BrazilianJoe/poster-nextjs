"use client"; // Needs to be client for useTitle hook and potentially data fetching hooks

import React, { useEffect } from 'react';
import { notFound, useParams } from "next/navigation"; // Import useParams
import { api } from "~/trpc/react"; // Use react hooks
import { useTitle } from "~/app/_components/app-layout"; // Remove AppLayout import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Loader2 } from 'lucide-react';

export default function PostPage() {
  const { setTitle } = useTitle();
  const params = useParams(); // Get params using the hook
  
  // Ensure postId is a string
  const postId = typeof params.postId === 'string' ? params.postId : undefined;

  const { data: post, isLoading, error } = api.post.getById.useQuery(
    postId ?? "", 
    { enabled: !!postId } // Only run query if postId exists
  );

  // Set the title based on fetched data
  useEffect(() => {
    if (post) {
      setTitle(`${post.postType} - ${post.targetPlatform}`); 
    } else if (isLoading) {
      setTitle("Loading Post...");
    } else {
      setTitle("Post Details");
    }
  }, [post, isLoading, setTitle]);

  if (!postId) {
    // Trigger notFound if postId is missing
    return notFound();
  }

  if (isLoading) {
    // Return loading indicator; AppLayout handles initial title
    return (
      <div className="flex h-full flex-col p-4 md:p-6 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (error || !post) {
    // Return error message; AppLayout handles error title
    return (
      <div className="p-4 md:p-6">
        <p className="text-destructive">
          Error loading post: {error?.message || 'Post not found.'}
        </p>
      </div>
    );
  }

  // Render post details - AppLayout is provided by the parent layout
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{post.postType} for {post.targetPlatform}</CardTitle>
          <CardDescription>Project ID: {post.projectId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Content Pieces:</h4>
            {post.contentPieces.map((content, index) => (
              <p key={index} className="p-2 border rounded mb-2 bg-muted/50">{content}</p>
            ))}
          </div>
          {post.mediaLinks && post.mediaLinks.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Media Links:</h4>
              <ul className="list-disc list-inside">
                {post.mediaLinks.map((link, index) => (
                  <li key={index}><a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{link}</a></li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-4">Post ID: {post.id}</p>
        </CardContent>
      </Card>
    </div>
  );
} 