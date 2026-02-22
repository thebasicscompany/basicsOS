"use client";

import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from "@basicsos/ui";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

// Next.js App Router requires default exports for page segments.
// This is a framework-mandated exception to the project's named-export rule.
const InvitePage = ({ params }: InvitePageProps): JSX.Element => {
  const router = useRouter();
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    void params.then(({ token: t }) => setToken(t));
  }, [params]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    data,
    isLoading,
    error: queryError,
  } = trpc.auth.validateInvite.useQuery({ token }, { enabled: token !== "" });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!data) return;
    setError(null);
    setLoading(true);
    const { error: authError } = await authClient.signUp.email({
      name,
      email: data.email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "Registration failed");
      return;
    }
    // Invited users join an existing company — go straight to the dashboard
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-200 dark:bg-stone-950">
        <p className="text-stone-500">Validating invite…</p>
      </div>
    );
  }

  if (queryError !== null || data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-200 dark:bg-stone-950">
        <p className="text-destructive">
          {queryError?.message ?? "Invalid or expired invite link."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-200 dark:bg-stone-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invite</CardTitle>
          <p className="text-sm text-stone-500">
            You&apos;ve been invited to join Basics OS as <strong>{data.role}</strong>.
          </p>
        </CardHeader>
        <CardContent>
          {error !== null && (
            <p className="mb-4 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                readOnly
                className="bg-stone-50 text-stone-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? "Joining…" : "Join Basics OS"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitePage;
