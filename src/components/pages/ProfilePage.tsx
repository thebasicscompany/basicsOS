"use client";

import {
  SignOutIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useMe } from "@/hooks/use-me";
import { authClient } from "@/lib/auth-client";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/contexts/page-header";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function ProfilePage() {
  usePageTitle("Profile");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me, isPending, isError, refetch } = useMe();
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateMeMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string }) =>
      fetchApi("/api/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      authClient
        .updateUser({ name: `${variables.firstName} ${variables.lastName}` })
        .catch(() => {});
      toast.success("Profile updated");
      setEditingName(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update"),
  });

  const handleStartEdit = useCallback(() => {
    setFirstName(me?.firstName ?? "");
    setLastName(me?.lastName ?? "");
    setEditingName(true);
  }, [me?.firstName, me?.lastName]);

  const handleSaveName = useCallback(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f || !l) {
      toast.error("First and last name are required");
      return;
    }
    updateMeMutation.mutate({ firstName: f, lastName: l });
  }, [firstName, lastName, updateMeMutation]);

  const handleCancelEdit = useCallback(() => {
    setEditingName(false);
  }, []);

  const handleChangePassword = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    });
    if (error) {
      toast.error(error.message ?? "Failed to change password");
      return;
    }
    toast.success("Password changed");
    setChangePasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [currentPassword, newPassword, confirmPassword]);

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col overflow-auto pb-8">
      <p className="mb-6 text-sm text-muted-foreground">
        Your account details
      </p>

      <div className="max-w-sm space-y-4">
        {isPending ? (
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-3 text-[13px] text-destructive">
            Failed to load profile.
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[13px]"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : me ? (
          <>
            {/* Name & avatar */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {me.fullName
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  {editingName ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="firstName" className="text-[11px]">
                            First name
                          </Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="mt-0.5 h-7 text-[13px]"
                            autoFocus
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName" className="text-[11px]">
                            Last name
                          </Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="mt-0.5 h-7 text-[13px]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-6 gap-1 text-[12px]"
                          onClick={handleSaveName}
                          disabled={updateMeMutation.isPending}
                        >
                          <CheckIcon className="size-3" />
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-[12px]"
                          onClick={handleCancelEdit}
                        >
                          <XIcon className="size-3" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-[13px] font-medium">{me.fullName}</p>
                        {me.email && (
                          <p className="text-[11px] text-muted-foreground">
                            {me.email}
                          </p>
                        )}
                        {me.administrator && (
                          <p className="text-[11px] text-muted-foreground">
                            Administrator
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={handleStartEdit}
                        aria-label="Edit name"
                      >
                        <PencilSimpleIcon className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Change password */}
            <div className="rounded-lg border p-4">
              <h2 className="text-[13px] font-medium">Password</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Change your account password.
              </p>
              {changePasswordOpen ? (
                <div className="mt-3 space-y-2">
                  <div>
                    <Label htmlFor="currentPassword" className="text-[11px]">
                      Current password
                    </Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-0.5 h-7 text-[13px]"
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPassword" className="text-[11px]">
                      New password
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-0.5 h-7 text-[13px]"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-[11px]">
                      Confirm new password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-0.5 h-7 text-[13px]"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-6 text-[12px]"
                      onClick={handleChangePassword}
                    >
                      Update password
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[12px]"
                      onClick={() => {
                        setChangePasswordOpen(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-7 text-[12px]"
                  onClick={() => setChangePasswordOpen(true)}
                >
                  Change password
                </Button>
              )}
            </div>
          </>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-[13px] text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <SignOutIcon className="size-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

ProfilePage.path = "/profile";
