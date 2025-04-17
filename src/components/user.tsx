"use client"

import { useClerk, SignOutButton } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useSidebar } from "~/components/ui/sidebar"
import { SidebarMenuButton } from "~/components/ui/sidebar"
import { cn } from "~/lib/utils"
import Link from "next/link"

export function User() {
  const { user } = useClerk()
  const { open: isSidebarOpen } = useSidebar()

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className={cn(
            "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
            !isSidebarOpen && "p-0 justify-center"
          )}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.imageUrl} alt={user.fullName ?? ""} />
              <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
            </Avatar>
          </div>
          {isSidebarOpen && (
            <div className="ml-2 flex flex-col items-start">
              <span className="text-sm font-medium">{user.fullName}</span>
              <span className="text-xs text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</span>
            </div>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/user">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SignOutButton>
          <DropdownMenuItem>
            Log out
          </DropdownMenuItem>
        </SignOutButton>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 