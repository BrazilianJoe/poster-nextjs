"use client"

import * as React from "react"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Icons } from "~/components/icons"
import { CustomerSwitcher } from "~/components/customer-switcher"
import { User } from "~/components/user"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible"
import { api } from "~/trpc/react"
import type { Conversation, Post } from "~/server/data/types"
import { useSidebar } from "~/components/ui/sidebar"
import { MessageSquare, ChevronRight, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Icons.dashboard,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { open, setOpen, isMobile } = useSidebar()
  const { data: customers = [] } = api.customer.list.useQuery()
  const [activeCustomer, setActiveCustomer] = React.useState<string | undefined>(undefined)
  const { data: projects = [] } = api.project.list.useQuery(activeCustomer)
  const router = useRouter()

  React.useEffect(() => {
    setOpen(!isMobile)
  }, [isMobile, setOpen])

  // Set the first customer as active when customers are loaded
  React.useEffect(() => {
    if (customers.length > 0 && !activeCustomer) {
      const firstCustomer = customers[0]
      if (firstCustomer) {
        setActiveCustomer(firstCustomer.id)
      }
    }
  }, [customers, activeCustomer])

  // Update the URL when the active customer changes
  React.useEffect(() => {
    if (activeCustomer) {
      const url = new URL(window.location.href)
      url.searchParams.set('customer', activeCustomer)
      window.history.replaceState({}, '', url.toString())
    }
  }, [activeCustomer])

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r bg-background transition-all duration-300 ease-in-out",
        open ? "w-64" : "w-12"
      )}
    >
      <div className={cn(
        "flex h-16 items-center border-b",
        open ? "px-4" : "px-1"
      )}>
        <CustomerSwitcher 
          onCustomerChange={setActiveCustomer} 
          activeCustomerId={activeCustomer}
        />
      </div>
      <ScrollArea className="flex-1">
        <nav className={cn(
          "grid items-start gap-2",
          open ? "p-4" : "p-2"
        )}>
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent" : "transparent",
                  open ? "px-3 py-2" : "px-2 py-2"
                )}
              >
                <item.icon className="h-4 w-4" />
                {open && <span className="ml-2">{item.name}</span>}
              </Link>
            )
          })}

          <Collapsible>
            <CollapsibleTrigger className={cn(
              "group flex w-full items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
              open ? "px-3 py-2" : "px-2 py-2"
            )}>
              <Icons.folder className="h-4 w-4" />
              {open && (
                <>
                  <span className="ml-2">Projects</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Icons.chevronRight className="h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    <div 
                      className="flex h-4 w-4 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground"
                      onClick={() => console.log('Add project')}
                    >
                      <Icons.plus className="h-4 w-4" />
                    </div>
                  </div>
                </>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className={cn(
              "pl-4",
              !open && "pl-2"
            )}>
              {projects?.map((project) => (
                <Collapsible key={project.id}>
                  <CollapsibleTrigger className={cn(
                    "group flex w-full items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    open ? "px-3 py-2" : "px-2 py-2"
                  )}>
                    {open && (
                      <>
                        <span>{project.name}</span>
                        <Icons.chevronRight className="ml-auto h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className={cn(
                    "pl-4",
                    !open && "pl-2"
                  )}>
                    <Collapsible>
                      <CollapsibleTrigger className={cn(
                        "group flex w-full items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                        open ? "px-3 py-2" : "px-2 py-2"
                      )}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {open && (
                          <>
                            <span>Conversations</span>
                            <div className="ml-auto flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/project/${project.id}/conversation/new`);
                                }}
                                className="flex h-4 w-4 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground"
                              >
                                <Plus className="h-4 w-4" />
                              </div>
                            </div>
                          </>
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent className={cn(
                        "pl-4",
                        !open && "pl-2"
                      )}>
                        <ProjectConversations projectId={project.id} open={open} />
                      </CollapsibleContent>
                    </Collapsible>
                    <Collapsible>
                      <CollapsibleTrigger className={cn(
                        "group flex w-full items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                        open ? "px-3 py-2" : "px-2 py-2"
                      )}>
                        <Icons.post className="mr-2 h-4 w-4" />
                        {open && (
                          <>
                            <span>Posts</span>
                            <div className="ml-auto flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/project/${project.id}/post/new`);
                                }}
                                className="flex h-4 w-4 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground"
                              >
                                <Plus className="h-4 w-4" />
                              </div>
                            </div>
                          </>
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent className={cn(
                        "pl-4",
                        !open && "pl-2"
                      )}>
                        <ProjectPosts projectId={project.id} open={open} />
                      </CollapsibleContent>
                    </Collapsible>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </nav>
      </ScrollArea>
      <div className={cn(
        "mt-auto border-t flex items-center",
        open ? "p-4" : "px-1 py-4"
      )}>
        <User />
      </div>
    </div>
  )
}

function ProjectConversations({ projectId, open }: { projectId: string; open: boolean }) {
  const { data: conversations, isLoading, error } = api.conversation.list.useQuery(projectId)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading conversations...</div>
  }

  if (error) {
    console.error("Error loading conversations:", error)
    return <div className="text-sm text-destructive">Error loading conversations</div>
  }

  if (!conversations?.length) {
    return <div className="text-sm text-muted-foreground">No conversations</div>
  }

  return (
    <>
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`/conversations/${conversation.id}`}
          className="group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          {open && <span>{conversation.title}</span>}
        </Link>
      ))}
    </>
  )
}

function ProjectPosts({ projectId, open }: { projectId: string; open: boolean }) {
  const { data: posts, isLoading, error } = api.post.list.useQuery(projectId)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading posts...</div>
  }

  if (error) {
    console.error("Error loading posts:", error)
    return <div className="text-sm text-destructive">Error loading posts</div>
  }

  if (!posts?.length) {
    return <div className="text-sm text-muted-foreground">No posts</div>
  }

  return (
    <>
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/posts/${post.id}`}
          className="group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          {open && <span>{post.targetPlatform} - {post.postType}</span>}
        </Link>
      ))}
    </>
  )
}
