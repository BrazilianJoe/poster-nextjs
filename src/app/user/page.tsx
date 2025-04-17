import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { AppLayout } from "~/app/_components/app-layout";
import { UserProfileClient } from "./user-profile-client";
import { auth } from "@clerk/nextjs/server"; // Use server-side auth

export default async function UserProfilePage() {
  // Check if user is authenticated using Clerk's server helper
  const authResult = await auth();
  const userId = authResult?.userId;
  
  if (!userId) {
    // If not authenticated, redirect to sign-in
    redirect("/sign-in");
  }

  try {
    // Fetch the current user's data using the tRPC procedure
    const user = await api.user.getCurrent();

    if (!user) {
      // This might happen if the user exists in Clerk but not in our DB yet
      // Or if there was an error fetching
      return (
        <AppLayout title="User Profile">
          <div className="p-4 md:p-6">
            <p>Error: Could not load user profile.</p>
            <p className="text-xs text-muted-foreground">Clerk ID: {userId}</p>
          </div>
        </AppLayout>
      );
    }

    // Render the client component with the fetched user data
    return (
      <AppLayout title="User Profile">
        <UserProfileClient user={user} />
      </AppLayout>
    );
  } catch (error) {
    console.error("Error loading user profile:", error);
    return (
      <AppLayout title="Error">
        <div className="p-4 md:p-6">
          <p>Error loading user profile. Please try again.</p>
        </div>
      </AppLayout>
    );
  }
} 