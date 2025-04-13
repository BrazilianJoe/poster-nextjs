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

  React.useEffect(() => {
    setOpen(!isMobile)
  }, [isMobile, setOpen])

  // Set the first customer as active when customers are loaded
  React.useEffect(() => {
    if (customers.length > 0 && !activeCustomer) {
      setActiveCustomer(customers[0]?.id)
    }
  }, [customers, activeCustomer])

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r bg-background transition-all duration-300 ease-in-out",
        open ? "w-64" : "w-16"
      )}
    >
      <div className={cn(
        "flex h-16 items-center border-b",
        open ? "px-4" : "px-2"
      )}>
        <CustomerSwitcher onCustomerChange={setActiveCustomer} />
      </div>
      <ScrollArea className="flex-1">
        <nav className="grid items-start gap-2 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent" : "transparent"
                )}
              >
                <item.icon className="h-4 w-4" />
                {open && <span className="ml-2">{item.name}</span>}
              </Link>
            )
          })}

          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              <Icons.folder className="h-4 w-4" />
              {open && (
                <>
                  <span className="ml-2">Projects</span>
                  <Icons.chevronRight className="ml-auto h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4">
              {projects?.map((project) => (
                <Collapsible key={project.id}>
                  <CollapsibleTrigger className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                    {open && (
                      <>
                        <span>{project.name}</span>
                        <Icons.chevronRight className="ml-auto h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4">
                    <Collapsible>
                      <CollapsibleTrigger className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                        <Icons.message className="h-4 w-4" />
                        {open && (
                          <>
                            <span className="ml-2">Conversations</span>
                            <Icons.chevronRight className="ml-auto h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          </>
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4">
                        <ProjectConversations projectId={project.id} open={open} />
                      </CollapsibleContent>
                    </Collapsible>
                    <Collapsible>
                      <CollapsibleTrigger className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                        <Icons.post className="h-4 w-4" />
                        {open && (
                          <>
                            <span className="ml-2">Posts</span>
                            <Icons.chevronRight className="ml-auto h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          </>
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4">
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
        open ? "p-4" : "px-2 py-4"
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
