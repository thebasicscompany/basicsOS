"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Card, CardContent } from "@basicsos/ui";

// Next.js App Router requires default exports for page segments.
// This is a framework-mandated exception to the project's named-export rule.
const RegisterPage = (): JSX.Element => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message ?? "Registration failed");
      return;
    }
    // New users go through onboarding before reaching the dashboard
    router.push("/onboarding");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md p-8">
        <CardContent className="p-0">
        {/* Brand */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-lg font-bold text-primary-foreground">
            B
          </div>
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Create account</h1>
        {error !== null && (
          <p className="mb-4 rounded-sm bg-destructive/5 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
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
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </a>
        </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
