import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getRuntimeApiUrl } from "@/lib/runtime-config";
import { ROUTES } from "@basics-os/hub";
import basicsIcon from "@/assets/basicos-icon.png";

interface LoginForm {
  email: string;
  password: string;
}

const isElectron = typeof window !== "undefined" && !!window.electronAPI?.openAuthBrowser;

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [webAuthPending, setWebAuthPending] = useState(false);
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
    });
    if (signInError) {
      setError(signInError.message ?? "Login failed");
    } else {
      // Electron uses HashRouter in the packaged app, so keep navigation client-side.
      navigate(ROUTES.CRM);
    }
  };

  const openHostedLogin = async () => {
    setWebAuthPending(true);
    const apiUrl = getRuntimeApiUrl();
    await window.electronAPI!.openAuthBrowser!("login", apiUrl);
    setWebAuthPending(false);
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
            <p className="text-sm text-muted-foreground">Basics OS</p>
          </div>
        </div>
        {isElectron && (
          <>
            <Button
              className="w-full"
              onClick={() => void openHostedLogin()}
              disabled={webAuthPending}
            >
              {webAuthPending ? "Opening browser..." : "Sign in via BasicOS"}
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t" />
            </div>
          </>
        )}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-9"
                {...register("password", { required: true })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 size-7 -translate-y-1/2"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeSlashIcon className="size-3.5" />
                ) : (
                  <EyeIcon className="size-3.5" />
                )}
              </Button>
            </div>
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
