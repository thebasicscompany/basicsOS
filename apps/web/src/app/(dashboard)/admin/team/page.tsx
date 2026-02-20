"use client";

import { trpc } from "@/lib/trpc";
import { Button, Badge, PageHeader, Card, Avatar, AvatarFallback, EmptyState, Users } from "@basicsos/ui";
import { InviteMemberDialog } from "./InviteMemberDialog";
import { useAuth } from "@/providers/AuthProvider";
import type { UserRole } from "@basicsos/shared";

const ROLE_VARIANT: Record<UserRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  member: "secondary",
  viewer: "outline",
};

// Next.js App Router requires default exports for page segments.
// This is a framework-mandated exception to the project's named-export rule.
const TeamPage = (): JSX.Element => {
  const { user } = useAuth();

  // Use the auth.me procedure to show current user info
  const { data: me } = trpc.auth.me.useQuery();

  const initials = (user?.name ?? "A")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div>
      <PageHeader
        title="Team Management"
        description="Manage team members, roles, and invitations."
        className="mb-6"
        action={
          me?.role === "admin" ? (
            <InviteMemberDialog>
              <Button>Invite Member</Button>
            </InviteMemberDialog>
          ) : undefined
        }
      />

      {/* Current user card */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Your Account</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-stone-900">{user?.name ?? "\u2014"}</p>
              <p className="text-sm text-stone-500">{user?.email ?? "\u2014"}</p>
            </div>
          </div>
          {me?.role !== undefined && (
            <Badge variant={ROLE_VARIANT[me.role as UserRole] ?? "outline"}>
              {me.role}
            </Badge>
          )}
        </div>
      </Card>

      <EmptyState
        Icon={Users}
        heading="No other team members yet"
        description="Invite team members using the button above to start collaborating."
        className="mt-6"
      />
    </div>
  );
};

export default TeamPage;
