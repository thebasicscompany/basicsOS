"use client";

import { useState, Suspense } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@basicsos/ui";

// Next.js App Router requires default exports for page segments.
// This is a framework-mandated exception to the project's named-export rule.

const LoginForm = (): JSX.Element => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "Sign in failed");
      return;
    }
    const next = searchParams.get("next") ?? "/";
    router.push(next);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            B
          </div>
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-stone-900">Sign in</h1>
        {error !== null && (
          <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoFocus
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
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-primary hover:underline font-medium">
            Register
          </a>
        </p>
      </div>
    </div>
  );
};

const LoginPage = (): JSX.Element => {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
};

export default LoginPage;
