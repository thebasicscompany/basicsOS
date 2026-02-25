"use client";

// Next.js App Router requires default exports for page segments.
// This is a framework-mandated exception to the project's named-export rule.

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Button, Badge, PageHeader, Card, Avatar, AvatarFallback, EmptyState, Users,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  addToast, Trash2, Copy, Check, Clock, X, SectionLabel, Mail,
} from "@basicsos/ui";
import { InviteMemberDialog } from "./InviteMemberDialog";
import type { UserRole } from "@basicsos/shared";

const ROLE_VARIANT: Record<UserRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  member: "secondary",
  viewer: "outline",
};

const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const formatTimeAgo = (date: Date | string): string => {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const TeamPage = (): JSX.Element => {
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: members = [], isLoading } = trpc.admin.listMembers.useQuery();
  const { data: pendingInvites = [] } = trpc.admin.listPendingInvites.useQuery();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isAdmin = me?.role === "admin";

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

  const revokeInvite = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => {
      addToast({ title: "Invite revoked", variant: "success" });
      void utils.admin.listPendingInvites.invalidate();
    },
    onError: (err) =>
      addToast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCopyLink = async (token: string, inviteId: string): Promise<void> => {
    const appUrl = window.location.origin;
    const url = `${appUrl}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Team Management"
        description="Manage team members, roles, and invitations."
        className="mb-6"
        action={
          isAdmin ? (
            <InviteMemberDialog>
              <Button>Invite Member</Button>
            </InviteMemberDialog>
          ) : undefined
        }
      />

      <MembersCard
        members={members}
        isLoading={isLoading}
        isAdmin={isAdmin}
        meUserId={me?.userId}
        updateRole={updateRole}
        removeUser={removeUser}
      />

      {isAdmin && (
        <PendingInvitesCard
          invites={pendingInvites}
          copiedId={copiedId}
          revokeInvite={revokeInvite}
          onCopyLink={handleCopyLink}
        />
      )}
    </div>
  );
};

export default TeamPage;

/* ------------------------------------------------------------------ */
/* MembersCard                                                         */
/* ------------------------------------------------------------------ */

interface MembersCardProps {
  members: Array<{ id: string; name: string; email: string; role: string; avatarUrl: string | null; createdAt: Date | string }>;
  isLoading: boolean;
  isAdmin: boolean;
  meUserId: string | undefined;
  updateRole: { mutate: (v: { userId: string; role: UserRole }) => void; isPending: boolean };
  removeUser: { mutate: (v: { userId: string }) => void; isPending: boolean };
}

function MembersCard({ members, isLoading, isAdmin, meUserId, updateRole, removeUser }: MembersCardProps): JSX.Element {
  return (
    <Card className="overflow-hidden">
      {isLoading ? (
        <div className="p-8 text-center text-sm text-stone-500">Loading\u2026</div>
      ) : members.length === 0 ? (
        <EmptyState
          Icon={Users}
          heading="No team members yet"
          description="Invite team members using the button above to start collaborating."
        />
      ) : (
        <div className="divide-y divide-stone-100">
          {members.map((member) => {
            const isSelf = member.id === meUserId;
            return (
              <MemberRow
                key={member.id}
                member={member}
                isSelf={isSelf}
                isAdmin={isAdmin}
                updateRole={updateRole}
                removeUser={removeUser}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MemberRow({
  member,
  isSelf,
  isAdmin,
  updateRole,
  removeUser,
}: {
  member: { id: string; name: string; email: string; role: string };
  isSelf: boolean;
  isAdmin: boolean;
  updateRole: { mutate: (v: { userId: string; role: UserRole }) => void; isPending: boolean };
  removeUser: { mutate: (v: { userId: string }) => void; isPending: boolean };
}): JSX.Element {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-900">{member.name}</span>
            {isSelf && <span className="text-xs text-stone-500">(you)</span>}
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
}

/* ------------------------------------------------------------------ */
/* PendingInvitesCard                                                  */
/* ------------------------------------------------------------------ */

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date | string;
  createdAt: Date | string;
}

function PendingInvitesCard({
  invites,
  copiedId,
  revokeInvite,
  onCopyLink,
}: {
  invites: PendingInvite[];
  copiedId: string | null;
  revokeInvite: { mutate: (v: { inviteId: string }) => void; isPending: boolean };
  onCopyLink: (token: string, inviteId: string) => void;
}): JSX.Element {
  return (
    <div className="mt-8">
      <SectionLabel as="h2" className="mb-3">Pending Invites</SectionLabel>
      <Card className="overflow-hidden">
        {invites.length === 0 ? (
          <EmptyState
            Icon={Mail}
            heading="No pending invites"
            description="Invitations you send will appear here until they are accepted or revoked."
          />
        ) : (
          <div className="divide-y divide-stone-100">
            {invites.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                isCopied={copiedId === invite.id}
                revokeInvite={revokeInvite}
                onCopyLink={onCopyLink}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InviteRow({
  invite,
  isCopied,
  revokeInvite,
  onCopyLink,
}: {
  invite: PendingInvite;
  isCopied: boolean;
  revokeInvite: { mutate: (v: { inviteId: string }) => void; isPending: boolean };
  onCopyLink: (token: string, inviteId: string) => void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-stone-100 text-stone-500">
            <Mail className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <span className="font-medium text-stone-900">{invite.email}</span>
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <Clock className="h-3 w-3" />
            <span>Sent {formatTimeAgo(invite.createdAt)}</span>
            <span className="text-stone-300">&middot;</span>
            <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={ROLE_VARIANT[invite.role as UserRole] ?? "outline"}>
          {invite.role}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCopyLink(invite.token, invite.id)}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">{isCopied ? "Copied" : "Copy Link"}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={revokeInvite.isPending}
          onClick={() => {
            if (confirm(`Revoke invite for ${invite.email}?`))
              revokeInvite.mutate({ inviteId: invite.id });
          }}
        >
          <X className="h-3.5 w-3.5 text-destructive" />
          <span className="ml-1.5">Revoke</span>
        </Button>
      </div>
    </div>
  );
}
