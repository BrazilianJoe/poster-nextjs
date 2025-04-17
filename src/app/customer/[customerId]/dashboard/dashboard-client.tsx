"use client"

import { api } from "~/trpc/react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Building2, MessageSquare, FileText, Folder } from "lucide-react"
import type { Customer, Project, Conversation, Post } from "~/server/data/types"
import { useState, useEffect, useMemo } from "react"
import { Skeleton } from "~/components/ui/skeleton"
import { useCustomer } from "~/lib/context/customer-context"; // Import customer context hook

// Keep CustomerCard internal for now, but it now relies on context
function CustomerCard() { 
  const { customerId } = useCustomer(); // Get customerId from context
  const { data: customer } = api.customer.getById.useQuery(customerId ?? "", {
    enabled: !!customerId
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Information</CardTitle>
      </CardHeader>
      <CardContent>
        {customer ? (
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{customer.name}</h3>
              <p className="text-sm text-muted-foreground">{customer.industry}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Loading customer...</h3>
              <p className="text-sm text-muted-foreground">Context ID: {customerId ?? 'None'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivitySummaryCard({ 
  projectCount, 
  conversationCount, 
  postCount
}: { 
  projectCount: number;
  conversationCount: number | null;
  postCount: number | null;
}) {
  // ... (Card content remains the same) ...
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Section for Projects */}
          <div className="flex flex-col items-center gap-2">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Folder className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{projectCount}</p>
              <p className="text-sm text-muted-foreground">Projects</p>
            </div>
          </div>
          {/* Section for Conversations */}
          <div className="flex flex-col items-center gap-2">
            {conversationCount !== null ? (
              <>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{conversationCount}</p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </>
            )}
          </div>
          {/* Section for Posts */}
          <div className="flex flex-col items-center gap-2">
             {postCount !== null ? (
              <>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{postCount}</p>
                  <p className="text-sm text-muted-foreground">Posts</p>
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
             </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentActivityCard({ 
  recentProjects, 
  recentConversations, 
  recentPosts 
}: { 
  recentProjects: Project[]; 
  recentConversations: Conversation[] | null;
  recentPosts: Post[] | null;
}) {
  // ... (Card content remains the same) ...
   return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Section for Recent Projects */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Recent Projects</h3>
            <div className="space-y-2">
              {recentProjects.length > 0 ? (
                recentProjects.map(project => (
                  <div key={project.id} className="p-2 border rounded">
                    {project.name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent projects.</p>
              )}
            </div>
          </div>
          {/* Section for Recent Conversations */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Recent Conversations</h3>
            <div className="space-y-2">
              {recentConversations === null ? (
                <Skeleton className="h-10 w-full rounded" />
              ) : recentConversations.length > 0 ? (
                recentConversations.map((conversation) => (
                  <div key={conversation.id} className="p-2 border rounded">
                    {conversation.title}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent conversations.</p>
              )}
            </div>
          </div>
          {/* Section for Recent Posts */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Recent Posts</h3>
            <div className="space-y-2">
              {recentPosts === null ? (
                 <Skeleton className="h-10 w-full rounded" />
              ) : recentPosts.length > 0 ? (
                recentPosts.map((post) => (
                  <div key={post.id} className="p-2 border rounded">
                    {post.postType} - {post.targetPlatform}
                  </div>
                ))
              ) : (
                 <p className="text-sm text-muted-foreground">No recent posts.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardClient() {
  // REMOVED: useSearchParams
  // const searchParams = useSearchParams()
  // const customerIdFromParams = searchParams.get('customer')
  const { customerId } = useCustomer(); // Get customerId from context
  const utils = api.useUtils();

  const [allConversations, setAllConversations] = useState<Conversation[] | null>(null);
  const [allPosts, setAllPosts] = useState<Post[] | null>(null);

  // Get projects for the active customer using customerId from context
  const { data: projects = [], isLoading: isLoadingProjects } = api.project.list.useQuery(customerId ?? "", {
    enabled: !!customerId
  });

  // Effect to fetch conversations and posts when projects change
  useEffect(() => {
    if (isLoadingProjects || !customerId || projects.length === 0) {
      setAllConversations(null);
      setAllPosts(null);
      return;
    }

    let isCancelled = false;
    setAllConversations(null);
    setAllPosts(null);

    async function fetchAllData() {
      try {
        const conversationPromises = projects.map(project =>
          utils.client.conversation.list.query(project.id)
        );
        const postPromises = projects.map(project =>
          utils.client.post.list.query(project.id)
        );

        const [conversationResults, postResults] = await Promise.all([
          Promise.all(conversationPromises),
          Promise.all(postPromises)
        ]);

        if (!isCancelled) {
          const flattenedConversations = conversationResults.flat();
          const flattenedPosts = postResults.flat();
          setAllConversations(flattenedConversations);
          setAllPosts(flattenedPosts);
        }
      } catch (error) {
        console.error("Failed to fetch conversations or posts:", error);
        if (!isCancelled) {
          setAllConversations([]);
          setAllPosts([]);
        }
      }
    }

    fetchAllData();

    return () => {
      isCancelled = true;
    };
  // Include customerId in dependency array
  }, [projects, isLoadingProjects, customerId, utils]); 

  const conversationCount = useMemo(() => allConversations?.length ?? null, [allConversations]);
  const postCount = useMemo(() => allPosts?.length ?? null, [allPosts]);
  
  const recentProjects = useMemo(() => projects.slice(0, 3), [projects]);
  const recentConversations = useMemo(() => allConversations?.slice(0, 3) ?? null, [allConversations]);
  const recentPosts = useMemo(() => allPosts?.slice(0, 3) ?? null, [allPosts]);

  // Render loading state if customerId is not yet available from context
  if (!customerId) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[150px] w-full" />
            <Skeleton className="h-[150px] w-full" />
          </div>
          <Skeleton className="h-[300px] w-full" />
        </div>
      );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-2">
        {/* CustomerCard now gets customerId implicitly via context */}
        <CustomerCard /> 
        <ActivitySummaryCard 
          projectCount={isLoadingProjects ? 0 : projects.length} 
          conversationCount={conversationCount} 
          postCount={postCount}
        />
      </div>
      <RecentActivityCard 
        recentProjects={recentProjects}
        recentConversations={recentConversations}
        recentPosts={recentPosts}
      />
    </div>
  );
} 