"use client";

import { trpc } from "@/lib/trpc";
import { Button, Badge } from "@basicsos/ui";
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Team Management</h1>
          <p className="mt-1 text-sm text-stone-500">
            Manage team members, roles, and invitations.
          </p>
        </div>
        {me?.role === "admin" && (
          <InviteMemberDialog>
            <Button>Invite Member</Button>
          </InviteMemberDialog>
        )}
      </div>

      {/* Current user card */}
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Your Account</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {(user?.name ?? "A")
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <p className="font-medium text-stone-900">{user?.name ?? "—"}</p>
              <p className="text-sm text-stone-500">{user?.email ?? "—"}</p>
            </div>
          </div>
          {me?.role !== undefined && (
            <Badge variant={ROLE_VARIANT[me.role as UserRole] ?? "outline"}>{me.role}</Badge>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-stone-400">
        Team member management requires a user directory API. Invite new members using the button
        above.
      </p>
    </div>
  );
};

export default TeamPage;
