"use client"; // Page needs to be client to use the hook for setting title

import React, { useEffect } from 'react';
import { DashboardClient } from "./dashboard-client";
import { useTitle } from "~/app/_components/app-layout";

export default function CustomerDashboardPage() {
  const { setTitle } = useTitle();

  useEffect(() => {
    setTitle("Overview"); // Set the title for the AppLayout header provided by the parent layout
  }, [setTitle]);

  // Render only the client component. AppLayout is provided by customer/[customerId]/layout.tsx
  return <DashboardClient />;
} 