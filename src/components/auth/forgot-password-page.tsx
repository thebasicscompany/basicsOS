import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getRuntimeApiUrl } from "@/lib/runtime-config";
import basicsIcon from "@/assets/basicos-icon.png";

interface ForgotPasswordForm {
  email: string;
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordForm>();

  const onSubmit = async ({ email }: ForgotPasswordForm) => {
    setError(null);
    // Use API URL when origin is file:// (Electron) or otherwise invalid for web redirects
    const apiBase = getRuntimeApiUrl();
    const origin =
      window.location.origin?.startsWith("http") && !window.location.origin?.startsWith("file")
        ? window.location.origin
        : apiBase.replace(/\/$/, "");
    const redirectTo = origin ? `${origin}/set-password` : "/set-password";
    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo,
    });
    if (resetError) {
      setError(resetError.message ?? "Failed to send reset email");
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="flex flex-col items-center gap-6">
          <img
            src={basicsIcon}
            alt="BasicsOS"
            className="h-12 w-12 object-contain"
          />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Forgot your password?
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your email to receive a reset link
            </p>
          </div>
        </div>
        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, we&apos;ve sent a password
              reset link.
            </p>
            <Link to="/">
              <Button variant="outline" className="w-full">
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-destructive text-sm text-center rounded-md bg-destructive/10 p-2">
                {error}
              </p>
            )}
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...register("email", { required: true })}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              <Link className="underline" to="/">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
