"use client"

import { DashboardClient } from "./dashboard-client"
import { AppLayout } from "~/app/_components/app-layout"

export default function DashboardPage() {
  return (
    <AppLayout title="Overview">
      <DashboardClient />
    </AppLayout>
  )
}
