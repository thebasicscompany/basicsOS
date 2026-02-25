"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { addToast } from "@basicsos/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Copy,
  Check,
} from "@basicsos/ui";
import type { UserRole } from "@basicsos/shared";

interface InviteMemberDialogProps {
  children: React.ReactNode;
}

export const InviteMemberDialog = ({ children }: InviteMemberDialogProps): JSX.Element => {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sendInvite = trpc.auth.sendInvite.useMutation({
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl);
      void utils.admin.listPendingInvites.invalidate();
      addToast({
        title: "Invite created",
        description: `Invitation created for ${email}`,
        variant: "success",
      });
    },
    onError: (err) => {
      addToast({
        title: "Failed to create invite",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!email.trim()) return;
    sendInvite.mutate({ email: email.trim(), role });
  };

  const handleCopyLink = async (): Promise<void> => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (isOpen: boolean): void => {
    setOpen(isOpen);
    if (!isOpen) {
      setEmail("");
      setRole("member");
      setInviteUrl(null);
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inviteUrl ? "Invite Created" : "Invite Team Member"}</DialogTitle>
        </DialogHeader>

        {inviteUrl ? (
          <InviteLinkView
            email={email}
            inviteUrl={inviteUrl}
            copied={copied}
            onCopy={() => void handleCopyLink()}
            onClose={() => handleClose(false)}
          />
        ) : (
          <InviteForm
            email={email}
            role={role}
            isPending={sendInvite.isPending}
            onEmailChange={setEmail}
            onRoleChange={setRole}
            onSubmit={handleSubmit}
            onCancel={() => handleClose(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

function InviteLinkView({
  email,
  inviteUrl,
  copied,
  onCopy,
  onClose,
}: {
  email: string;
  inviteUrl: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-stone-600">
        Share this link with <span className="font-medium text-stone-900">{email}</span> to
        join your workspace:
      </p>
      <div className="flex items-center gap-2">
        <Input value={inviteUrl} readOnly className="font-mono text-xs" />
        <Button type="button" variant="outline" size="sm" onClick={onCopy} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-stone-500">This link expires in 7 days.</p>
      <DialogFooter>
        <Button type="button" onClick={onClose}>Done</Button>
      </DialogFooter>
    </div>
  );
}

function InviteForm({
  email,
  role,
  isPending,
  onEmailChange,
  onRoleChange,
  onSubmit,
  onCancel,
}: {
  email: string;
  role: UserRole;
  isPending: boolean;
  onEmailChange: (v: string) => void;
  onRoleChange: (v: UserRole) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={(v) => onRoleChange(v as UserRole)}>
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating\u2026" : "Send Invite"}
        </Button>
      </DialogFooter>
    </form>
  );
}
