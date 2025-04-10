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
import { ScrollArea } from "~/components/ui/scroll-area"; // Added ScrollArea
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
          <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex w-full items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Overview</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
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
            <div className="flex-1 overflow-auto">
              {/* Scrollable main content area */}
              <ScrollArea className="h-[calc(98vh-4rem)]">
                <div className="flex flex-2 flex-col gap-4 p-4">
                  <div className="rounded-xl bg-muted/50 p-4 text-foreground">
                    <p>$: {hello ? hello.greeting : "Loading..."}</p>
                  </div>
                  {/* Grid container for user content and placeholders */}
                  <div className="grid auto-rows-min gap-4 md:grid-cols-1">
                    {/* User Content Area */}
                    <div className="bg-muted/50 rounded-xl p-4">
                      Tech & Software:

                      Pixel Pioneers Inc.
Logic Leap Labs
Data Grove Dynamics
Byte Bloom Technologies
Synapse Solutions
Aether Computing
Quantum Quill Software
Food & Beverage:
8.  Sunrise Cafe & Bakery
9.  Golden Grain Goods
10. Meadow Lark Dairy
11. Starlight Soda Co.
12. The Cheerful Crumb
13. Harbor Roast Coffee
14. Crimson Kettle Foods

Retail & Goods:
15. Evergreen Emporium
16. Blue Jay Boutiques
17. The Curious Crate
18. Maple & Pine Outfitters
19. Silver Spool Textiles
20. Cobblestone Crafts & Wares
21. Whispering Willows Home Goods

Services & Consulting:
22. Apex Advisory Group
23. Horizon Helpers Co.
24. Bright Spark Consulting
25. Keystone Planning Partners
26. Summit Strategy Services
27. Clear Path Solutions
28. Anchor Point Advisors

Creative & Media:
29. Canvas & Quill Studios
30. Melody Makers Inc.
31. Story Weavers Productions
32. Prism Point Pictures
33. Inkwell Ideas Agency
34. Echo Chamber Entertainment
35. Fable Forge Media

General & Industrial:
36. Acorn Industries
37. Benchmark Enterprises
38. Concord Collective
39. Delta Dynamics Corp.
40. Ethos Group International
41. Foundation Forward Ventures
42. Guardian Global Solutions
43. Ironwood Manufacturing
44. NovaCore Industries
45. Pinnacle Holdings
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </HydrateClient>
  );
}