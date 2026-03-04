import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface SignupForm {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isValid },
  } = useForm<SignupForm>({ mode: "onChange" });

  const onSubmit = async (data: SignupForm) => {
    setError(null);
    const res = await fetch(`${API_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError((json as { error?: string }).error ?? "Signup failed");
      return;
    }
    // Auto-login after signup
    const { error: loginError } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    });
    if (loginError) {
      navigate("/login");
    } else {
      navigate("/contacts");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-6">
          <img
            src="/basicos-wordmark.png"
            alt="BasicsOS"
            className="h-8 w-auto object-contain"
          />
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-bold">Welcome to Basics CRM</h1>
            <p className="text-muted-foreground text-sm">
              Create the first user account to complete setup.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-destructive text-sm rounded-md bg-destructive/10 p-2">{error}</p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name</Label>
            <Input
              id="first_name"
              {...register("first_name", { required: true })}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input
              id="last_name"
              {...register("last_name", { required: true })}
              autoComplete="family-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email", { required: true })}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password", { required: true, minLength: 8 })}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
