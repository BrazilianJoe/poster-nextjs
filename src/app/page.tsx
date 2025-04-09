import { SignedIn, SignedOut, SignInButton, SignUpButton, SignOutButton } from "@clerk/nextjs"; // Keep Clerk
import { AppSidebar } from "~/components/app-sidebar"; // From Dashboard
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"; // From Dashboard
import { Separator } from "~/components/ui/separator"; // From Dashboard
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"; // From Dashboard
import { api, HydrateClient } from "~/trpc/server"; // Keep TRPC

export default async function Home() {
  // Keep TRPC data fetching
  const hello = await api.post.hello({ text: "from tRPC" });
  void api.post.getLatest.prefetch(); // Keep prefetch, though not used in UI yet

  return (
    // Keep HydrateClient wrapper
    <HydrateClient>
      {/* Insert Dashboard UI Structure */}
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex w-full items-center gap-2 px-4"> {/* Added w-full */}
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Home</BreadcrumbLink> {/* Updated Breadcrumb */}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Overview</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              {/* Add Clerk buttons to the right */}
               <div className="ml-auto flex gap-2">
                 <SignedOut>
                   <SignInButton mode="modal">
                     <button className="rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20">
                       Sign In
                     </button>
                   </SignInButton>
                   <SignUpButton mode="modal">
                     <button className="rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20">
                       Sign Up
                     </button>
                   </SignUpButton>
                 </SignedOut>
                 <SignedIn>
                   <SignOutButton>
                     <button className="rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20">
                       Sign Out
                     </button>
                   </SignOutButton>
                 </SignedIn>
               </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
             {/* Display fetched data */}
             <div className="rounded-xl bg-muted/50 p-4 text-foreground"> {/* Use theme foreground */}
               <p>tRPC Greeting: {hello ? hello.greeting : "Loading..."}</p>
             </div>
             {/* Keep placeholder content divs */}
            <div className="grid auto-rows-min gap-4 md:grid-cols-3">
              <div className="bg-muted/50 aspect-video rounded-xl" />
              <div className="bg-muted/50 aspect-video rounded-xl" />
              <div className="bg-muted/50 aspect-video rounded-xl" />
            </div>
            <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </HydrateClient>
  );
}