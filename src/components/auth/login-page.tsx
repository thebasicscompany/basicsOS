import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@basics-os/hub";
import basicsIcon from "@/assets/basicos-icon.png";

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginForm>();

  const onSubmit = async ({ email, password }: LoginForm) => {
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: ROUTES.CRM,
    });
    if (signInError) {
      setError(signInError.message ?? "Login failed");
    } else {
      navigate(ROUTES.CRM);
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
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Basics CRM</p>
          </div>
        </div>
        {error && (
          <p className="text-destructive text-sm text-center rounded-md bg-destructive/10 p-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email", { required: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password", { required: true })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Have an invite token?{" "}
            <Link className="underline" to="/sign-up">
              Create account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
