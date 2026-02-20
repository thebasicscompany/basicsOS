"use client";

// Next.js App Router requires default exports for page segments.
// This is a framework-mandated exception to the project's named-export rule.

import { trpc } from "@/lib/trpc";
import { Button, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, addToast, Trash2 } from "@basicsos/ui";
import { InviteMemberDialog } from "./InviteMemberDialog";
import type { UserRole } from "@basicsos/shared";

const ROLE_VARIANT: Record<UserRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  member: "secondary",
  viewer: "outline",
};

const initials = (name: string): string =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const TeamPage = (): JSX.Element => {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: members = [], isLoading } = trpc.admin.listMembers.useQuery();

  const updateRole = trpc.admin.updateRole.useMutation({
    onSuccess: () => void utils.admin.listMembers.invalidate(),
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeUser = trpc.admin.removeUser.useMutation({
    onSuccess: () => {
      addToast({ title: "Member removed", variant: "success" });
      void utils.admin.listMembers.invalidate();
    },
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isAdmin = me?.role === "admin";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Team Management</h1>
          <p className="mt-1 text-sm text-stone-500">
            Manage team members, roles, and invitations.
          </p>
        </div>
        {isAdmin && (
          <InviteMemberDialog>
            <Button>Invite member</Button>
          </InviteMemberDialog>
        )}
      </div>

      <div className="rounded-xl border bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-stone-400">Loading…</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">No members found.</div>
        ) : (
          <div className="divide-y">
            {members.map((member) => {
              const isSelf = member.id === me?.userId;
              return (
                <div key={member.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(member.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-900">{member.name}</span>
                        {isSelf && (
                          <span className="text-xs text-stone-400">(you)</span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && !isSelf ? (
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateRole.mutate({ userId: member.id, role: role as UserRole })
                        }
                        disabled={updateRole.isPending}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={ROLE_VARIANT[member.role as UserRole] ?? "outline"}>
                        {member.role}
                      </Badge>
                    )}

                    {isAdmin && !isSelf && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={removeUser.isPending}
                        onClick={() => {
                          if (confirm(`Remove ${member.name} from the team?`))
                            removeUser.mutate({ userId: member.id });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamPage;
