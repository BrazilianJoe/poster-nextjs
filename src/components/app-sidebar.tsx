"use client"

import * as React from "react"
import { cn } from "~/lib/utils"
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
import { MessageSquare, ChevronRight, Plus, User as UserIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCustomer } from "~/lib/context/customer-context"

// Base navigation structure
const baseNavigation = [
  {
    name: "Dashboard",
    hrefTemplate: "/customer/[customerId]/dashboard", // Use template
    icon: Icons.dashboard,
  },
];

export function AppSidebar() {
  const pathname = usePathname()
  const { open, setOpen, isMobile } = useSidebar()
  const router = useRouter()
  const { customerId } = useCustomer(); // Get customerId from context

  // Fetch projects based on customerId from context
  const { data: projects = [] } = api.project.list.useQuery(customerId ?? "", { 
    enabled: !!customerId, // Only fetch if customerId is available
  });

  React.useEffect(() => {
    setOpen(!isMobile)
  }, [isMobile, setOpen])

  const generateHref = (template: string) => {
    if (!customerId && template.includes("[customerId]")) {
      return "#"; // Return a non-functional link if customerId is missing for a customer-specific route
    }
    return template.replace("[customerId]", customerId ?? "");
  };

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
        <CustomerSwitcher />
      </div>
      <ScrollArea className="flex-1">
        <nav className={cn(
          "grid items-start gap-2",
          open ? "p-4" : "p-2"
        )}>
          {baseNavigation.map((item) => {
            const href = generateHref(item.hrefTemplate);
            const isActive = pathname === href || (item.name === "Dashboard" && pathname.startsWith(`/customer/${customerId}/dashboard`));
            return (
              <Link
                key={item.name}
                href={href}
                className={cn(
                  "group flex items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent" : "transparent",
                  open ? "px-3 py-2" : "px-2 py-2",
                  href === "#" && "pointer-events-none opacity-50"
                )}
                aria-disabled={href === "#"}
                tabIndex={href === "#" ? -1 : undefined}
              >
                <item.icon className="h-4 w-4" />
                {open && <span className="ml-2">{item.name}</span>}
              </Link>
            );
          })}

          {open && <div className="my-2 border-t"></div>}

          {customerId && (
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger className={cn(
                "group flex w-full items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                open ? "px-3 py-2" : "px-2 py-2"
              )} disabled={!open}>
                <Icons.folder className="h-4 w-4" />
                {open && (
                  <>
                    <span className="ml-2">Projects</span>
                    <div className="ml-auto flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      <div 
                        className="flex h-4 w-4 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground"
                        onClick={(e) => {e.stopPropagation(); console.log('Add project')}}
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
                {projects?.map((project) => (
                  <Collapsible key={project.id} defaultOpen={true}>
                    <CollapsibleTrigger className={cn(
                      "group flex w-full items-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                      open ? "px-3 py-2" : "px-2 py-2"
                    )} disabled={!open}>
                      {open && (
                        <>
                          <span>{project.name}</span>
                          <ChevronRight className="ml-auto h-4 w-4 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        </>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className={cn(
                      "space-y-2 pl-4 pr-2",
                      !open && "pl-2"
                    )}>
                      <div className="space-y-1">
                        <div
                          className={cn(
                            "group flex w-full items-center rounded-md text-sm font-medium text-muted-foreground",
                            open ? "px-3 py-1" : "px-2 py-1"
                          )}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {open && (
                            <>
                              <span>Conversations</span>
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/customer/${customerId}/project/${project.id}/conversation/new`);
                                  }}
                                  className="flex h-5 w-5 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground"
                                  aria-label="New Conversation"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        <ProjectConversations customerId={customerId} projectId={project.id} open={open} />
                      </div>
                      <div className="space-y-1">
                        <div
                          className={cn(
                            "group flex w-full items-center rounded-md text-sm font-medium text-muted-foreground",
                             open ? "px-3 py-1" : "px-2 py-1"
                          )}
                        >
                          <Icons.post className="mr-2 h-4 w-4" />
                          {open && (
                            <>
                              <span>Posts</span>
                              <div className="ml-auto flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/customer/${customerId}/project/${project.id}/post/new`);
                                  }}
                                  className="flex h-5 w-5 items-center justify-center rounded-md p-0 hover:bg-accent hover:text-accent-foreground"
                                  aria-label="New Post"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        <ProjectPosts customerId={customerId} projectId={project.id} open={open} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
                 {projects.length === 0 && open && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No projects found.</div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </nav>
      </ScrollArea>
      <div className={cn(
        "mt-auto border-t flex items-center",
        open ? "p-4" : "px-1 py-4"
      )}>
        <User />
      </div>
    </div>
  );
}

interface ProjectItemsProps {
  customerId: string;
  projectId: string;
  open: boolean;
}

function ProjectConversations({ customerId, projectId, open }: ProjectItemsProps) {
  const { data: conversations, isLoading, error } = api.conversation.list.useQuery(projectId);

  if (isLoading) {
    return <div className="py-1 px-3 text-xs text-muted-foreground">Loading...</div>;
  }
  if (error) {
    console.error("Error loading conversations:", error);
    return <div className="py-1 px-3 text-xs text-destructive">Error</div>;
  }
  if (!conversations?.length) {
    return <div className="py-1 px-3 text-xs text-muted-foreground">None</div>;
  }

  return (
    <>
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`/customer/${customerId}/project/${projectId}/conversation/${conversation.id}`}
          className="group flex items-center rounded-md px-3 py-1 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          {open && <span>{conversation.title}</span>}
        </Link>
      ))}
    </>
  );
}

function ProjectPosts({ customerId, projectId, open }: ProjectItemsProps) {
  const { data: posts, isLoading, error } = api.post.list.useQuery(projectId);

  if (isLoading) {
    return <div className="py-1 px-3 text-xs text-muted-foreground">Loading...</div>;
  }
  if (error) {
    console.error("Error loading posts:", error);
    return <div className="py-1 px-3 text-xs text-destructive">Error</div>;
  }
  if (!posts?.length) {
    return <div className="py-1 px-3 text-xs text-muted-foreground">None</div>;
  }

  return (
    <>
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/customer/${customerId}/project/${projectId}/post/${post.id}`}
          className="group flex items-center rounded-md px-3 py-1 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          {open && <span>{post.targetPlatform} - {post.postType}</span>}
        </Link>
      ))}
    </>
  );
}
