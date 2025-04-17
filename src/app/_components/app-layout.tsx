"use client"

import { AppSidebar } from "~/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Separator } from "~/components/ui/separator"
import React, { useState, useMemo } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
  initialTitle?: string;
}

// Context to pass title down from Page to Layout header
interface TitleContextType {
  title: string;
  setTitle: (title: string) => void;
}
const TitleContext = React.createContext<TitleContextType | undefined>(undefined);

export function useTitle() {
  const context = React.useContext(TitleContext);
  if (!context) {
    throw new Error('useTitle must be used within an AppLayout');
  }
  return context;
}

export function AppLayout({ children, initialTitle = "Overview" }: AppLayoutProps) {
  const [title, setTitle] = useState<string>(initialTitle);
  const titleContextValue = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <TitleContext.Provider value={titleContextValue}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-screen flex-col">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
                />
                <Breadcrumb>
                  <BreadcrumbList>
                    {/* TODO: Make breadcrumb base dynamic based on context if needed */}
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TitleContext.Provider>
  )
} 