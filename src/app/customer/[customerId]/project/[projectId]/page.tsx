"use client"; // Needs to be client for useTitle hook and potentially data fetching hooks

import React, { useEffect } from 'react';
import { notFound } from "next/navigation";
import { api } from "~/trpc/react"; // Use react hooks
import { useTitle } from "~/app/_components/app-layout"; // Remove AppLayout import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Loader2 } from 'lucide-react';

interface ProjectPageProps {
  params: {
    // customerId is available via context if needed
    projectId: string;
  };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { setTitle } = useTitle();
  const projectId = params?.projectId;

  const { data: project, isLoading, error } = api.project.getById.useQuery(
    projectId ?? "", 
    { enabled: !!projectId } // Only run query if projectId exists
  );

  // Set the title based on fetched data
  useEffect(() => {
    if (project) {
      setTitle(project.name); 
    } else if (isLoading) {
      setTitle("Loading Project...");
    } else {
      setTitle("Project Details");
    }
  }, [project, isLoading, setTitle]);

  if (!projectId) {
    return notFound();
  }

  if (isLoading) {
    // Let AppLayout handle the initial loading title
    return (
      <div className="flex h-full flex-col p-4 md:p-6 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (error || !project) {
    // Let AppLayout handle the error title
    return (
      <div className="p-4 md:p-6">
        <p className="text-destructive">
          Error loading project: {error?.message || 'Project not found.'}
        </p>
      </div>
    );
  }

  // Render project details - AppLayout is provided by the parent layout
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
          <CardDescription>{project.objective || 'No objective set.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Project ID: {project.id}</p>
          <p>Customer ID: {project.customerId}</p>
          {/* Add more project details here as needed */} 
        </CardContent>
      </Card>
      {/* TODO: Add sections for project conversations, posts, etc. */}
    </div>
  );
} 