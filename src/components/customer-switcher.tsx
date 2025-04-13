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

interface CustomerSwitcherProps {
  onCustomerChange?: (customerId: string) => void
}

export function CustomerSwitcher({ onCustomerChange }: CustomerSwitcherProps) {
  const { isMobile, open: isSidebarOpen } = useSidebar()
  const { data: customers = [] } = api.customer.list.useQuery()
  const [activeCustomer, setActiveCustomer] = React.useState<Customer | undefined>(undefined)

  // Update active customer when customers data changes
  React.useEffect(() => {
    if (customers.length > 0 && !activeCustomer) {
      setActiveCustomer(customers[0])
    }
  }, [customers, activeCustomer])

  const handleCustomerChange = (customer: Customer) => {
    setActiveCustomer(customer)
    onCustomerChange?.(customer.id)
  }

  // If there are no customers, show a placeholder
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
                <span className="truncate text-xs">Add your first customer</span>
              </div>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // If there are customers but none is active yet, show loading state
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
                <span className="truncate font-medium">Loading...</span>
                <span className="truncate text-xs">Please wait</span>
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
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Building2 className="size-4" />
              </div>
              {isSidebarOpen && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{activeCustomer.name}</span>
                  <span className="truncate text-xs">{activeCustomer.industry}</span>
                </div>
              )}
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
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