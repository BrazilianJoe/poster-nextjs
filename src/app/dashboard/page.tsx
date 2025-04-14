import { AppSidebar } from "~/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { api } from "~/trpc/server"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Building2, MessageSquare, FileText, Folder } from "lucide-react"
import { headers } from "next/headers"

export default async function Page() {
  try {
    // Get the active customer
    const activeCustomer = await api.customer.getActive()

    const projects = activeCustomer?.id ? await api.project.list(activeCustomer.id) : []
    const conversations = activeCustomer?.id ? await api.conversation.list(activeCustomer.id) : []
    const posts = activeCustomer?.id ? await api.post.list(activeCustomer.id) : []

    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Overview</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeCustomer ? (
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{activeCustomer.name}</h3>
                        <p className="text-sm text-muted-foreground">{activeCustomer.industry}</p>
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
              <Card>
                <CardHeader>
                  <CardTitle>Activity Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Folder className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{projects.length}</p>
                        <p className="text-sm text-muted-foreground">Projects</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <MessageSquare className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{conversations.length}</p>
                        <p className="text-sm text-muted-foreground">Conversations</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{posts.length}</p>
                        <p className="text-sm text-muted-foreground">Posts</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="flex-1">
              <CardHeader>
                <CardTitle>Content Area</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[calc(100vh-24rem)] flex items-center justify-center">
                  {activeCustomer ? (
                    <p className="text-muted-foreground">Content will be added here</p>
                  ) : (
                    <p className="text-muted-foreground">Select a customer to view content</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  } catch (error) {
    console.error("Error loading dashboard:", error)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Error loading dashboard</h1>
          <p className="text-muted-foreground">Please try refreshing the page</p>
        </div>
      </div>
    )
  }
}
