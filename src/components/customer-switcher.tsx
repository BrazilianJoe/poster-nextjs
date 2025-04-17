"use client"

import * as React from "react"
import { Building2, ChevronsUpDown, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar"
import { api } from "~/trpc/react"
import type { Customer } from "~/server/data/types"
import { cn } from "~/lib/utils"
import { useRouter } from 'next/navigation';

export function CustomerSwitcher() {
  const { isMobile, open: isSidebarOpen } = useSidebar()
  const router = useRouter();
  const { data: customers = [], isLoading, error } = api.customer.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  })
  const [activeCustomer, setActiveCustomer] = React.useState<Customer | undefined>(undefined)

  React.useEffect(() => {
    if (customers.length > 0 && !activeCustomer) {
      setActiveCustomer(customers[0])
    }
  }, [customers, activeCustomer])

  const handleCustomerChange = (customer: Customer) => {
    setActiveCustomer(customer);
    router.push(`/customer/${customer.id}/dashboard`);
  }

  if (error) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="bg-destructive text-destructive-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </div>
            {isSidebarOpen && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Error loading</span>
                <span className="truncate text-xs">Please try again</span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </div>
            {isSidebarOpen && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Loading...</span>
                <span className="truncate text-xs">Please wait</span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (customers.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </div>
            {isSidebarOpen && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">No customers</span>
                <span className="truncate text-xs">Add customer</span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!activeCustomer) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </div>
            {isSidebarOpen && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Select customer</span>
                <span className="truncate text-xs">Loading...</span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="w-full">
              <SidebarMenuButton
                size="lg"
                className={cn(
                  "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                  !isSidebarOpen && "p-0 justify-center"
                )}
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
                </div>
                {isSidebarOpen && (
                  <>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{activeCustomer.name}</span>
                      <span className="truncate text-xs">{activeCustomer.industry ?? 'Industry N/A'}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                  </>
                )}
              </SidebarMenuButton>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Customers
            </DropdownMenuLabel>
            {customers.map((customer: Customer, index: number) => (
              <DropdownMenuItem
                key={customer.id}
                onClick={() => handleCustomerChange(customer)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Building2 className="size-3.5 shrink-0" />
                </div>
                {customer.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add customer</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
} 