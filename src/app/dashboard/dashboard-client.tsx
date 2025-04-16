"use client"

import { api } from "~/trpc/react"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Building2, MessageSquare, FileText, Folder } from "lucide-react"
import type { Customer, Project, Conversation, Post } from "~/server/data/types"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Skeleton } from "~/components/ui/skeleton"

// Types for aggregated data (Keep for potential future use, or remove if definitely not needed)
// interface ProjectTotals {
//   conversations: number;
//   posts: number;
// }

// interface RecentProjectItems {
//   conversations: Conversation[];
//   posts: Post[];
// }

function CustomerCard({ customerId }: { customerId: string | null }) {
  const { data: customer } = api.customer.getById.useQuery(customerId ?? "", {
    enabled: !!customerId
  })

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
              <h3 className="text-lg font-semibold">No active customer</h3>
              <p className="text-sm text-muted-foreground">Select a customer to get started</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// // Helper hook to fetch data for a single project (REMOVED)
// function useProjectItemData(projectId: string) { ... }

// // Hook to aggregate data from multiple projects (REMOVED)
// function useAggregateProjectData(projects: Project[]) { ... }


function ActivitySummaryCard({ 
  projectCount, 
  conversationCount, 
  postCount
}: { 
  projectCount: number;
  conversationCount: number | null; // Allow null for loading state
  postCount: number | null; // Allow null for loading state
}) {
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

// Updated RecentActivityCard to accept data props
function RecentActivityCard({ 
  recentProjects, 
  recentConversations, 
  recentPosts 
}: { 
  recentProjects: Project[]; 
  recentConversations: Conversation[] | null; // Allow null for loading
  recentPosts: Post[] | null; // Allow null for loading
}) {
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
                <p className="text-sm text-muted-foreground">No recent projects.</p> // Handle empty state
              )}
            </div>
          </div>
          {/* Section for Recent Conversations */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Recent Conversations</h3>
            <div className="space-y-2">
              {recentConversations === null ? (
                // Single skeleton for loading state
                <Skeleton className="h-10 w-full rounded" />
              ) : recentConversations.length > 0 ? (
                recentConversations.map((conversation) => (
                  <div key={conversation.id} className="p-2 border rounded">
                    {conversation.title}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent conversations.</p> // Handle empty state
              )}
            </div>
          </div>
          {/* Section for Recent Posts */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Recent Posts</h3>
            <div className="space-y-2">
              {recentPosts === null ? (
                 // Single skeleton for loading state
                 <Skeleton className="h-10 w-full rounded" />
              ) : recentPosts.length > 0 ? (
                recentPosts.map((post) => (
                  <div key={post.id} className="p-2 border rounded">
                    {post.postType} - {post.targetPlatform}
                  </div>
                ))
              ) : (
                 <p className="text-sm text-muted-foreground">No recent posts.</p> // Handle empty state
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardClient() {
  const searchParams = useSearchParams()
  const customerId = searchParams.get('customer')
  const utils = api.useUtils() // Get tRPC utils for imperative calls

  // State for full data arrays
  const [allConversations, setAllConversations] = useState<Conversation[] | null>(null)
  const [allPosts, setAllPosts] = useState<Post[] | null>(null)

  // Get projects for the active customer
  const { data: projects = [], isLoading: isLoadingProjects } = api.project.list.useQuery(customerId ?? "", {
    enabled: !!customerId
  })

  // Effect to fetch conversations and posts when projects change
  useEffect(() => {
    // Reset data when projects are loading or empty
    if (isLoadingProjects || projects.length === 0) {
      setAllConversations(null)
      setAllPosts(null)
      return
    }

    let isCancelled = false
    setAllConversations(null) // Set to loading before fetching
    setAllPosts(null)

    async function fetchAllData() {
      try {
        // Create promises for both conversations and posts
        const conversationPromises = projects.map(project =>
          utils.client.conversation.list.query(project.id)
        )
        const postPromises = projects.map(project =>
          utils.client.post.list.query(project.id)
        )

        // Await both sets of promises
        const [conversationResults, postResults] = await Promise.all([
          Promise.all(conversationPromises),
          Promise.all(postPromises)
        ])

        if (!isCancelled) {
          const flattenedConversations = conversationResults.flat()
          const flattenedPosts = postResults.flat()
          // Set the full arrays in state
          setAllConversations(flattenedConversations)
          setAllPosts(flattenedPosts)
        }
      } catch (error) {
        console.error("Failed to fetch conversations or posts:", error)
        if (!isCancelled) {
          setAllConversations([]) // Set to empty array on error
          setAllPosts([]) // Set to empty array on error
        }
      }
    }

    fetchAllData()

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isCancelled = true
    }
  }, [projects, isLoadingProjects, utils]) // Depend on projects and loading state

  // Derive counts and recent items from state
  const conversationCount = useMemo(() => allConversations?.length ?? null, [allConversations])
  const postCount = useMemo(() => allPosts?.length ?? null, [allPosts])
  
  const recentProjects = useMemo(() => projects.slice(0, 3), [projects])
  const recentConversations = useMemo(() => allConversations?.slice(0, 3) ?? null, [allConversations])
  const recentPosts = useMemo(() => allPosts?.slice(0, 3) ?? null, [allPosts])


  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-2">
        <CustomerCard customerId={customerId} />
        {/* Pass derived counts */}
        <ActivitySummaryCard 
          projectCount={isLoadingProjects ? 0 : projects.length} 
          conversationCount={conversationCount} 
          postCount={postCount}
        />
      </div>
      {/* Pass projects and derived recent items */}
      <RecentActivityCard 
        recentProjects={recentProjects}
        recentConversations={recentConversations}
        recentPosts={recentPosts}
      />
    </div>
  )
} 