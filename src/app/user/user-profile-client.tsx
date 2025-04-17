"use client";

import type { User } from "~/server/data/types";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

// Helper to get initials from name
function getInitials(name?: string | null): string {
  if (!name) return "?";
  const nameParts = name.trim().split(' ');
  const firstNameInitial = nameParts[0]?.[0] ?? '';
  const lastNameInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] ?? '' : '';
  return `${firstNameInitial}${lastNameInitial}`.toUpperCase();
}

interface UserProfileClientProps {
  user: User;
}

export function UserProfileClient({ user }: UserProfileClientProps) {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border">
              {/* Assuming user might have an image URL in the future */}
              {/* <AvatarImage src={user.imageUrl} alt={user.name ?? 'User avatar'} /> */}
              <AvatarFallback className="text-xl font-semibold">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{user.name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p>More user details will go here...</p>
          {/* Example: Displaying Clerk ID for debugging/info */}
          <p className="mt-4 text-xs text-muted-foreground">Clerk ID: {user.clerkId}</p>
          <p className="text-xs text-muted-foreground">Internal ID: {user.id}</p>
          <p className="text-xs text-muted-foreground">
            Subscription ID: {user.subscriptionId ?? 'N/A'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 