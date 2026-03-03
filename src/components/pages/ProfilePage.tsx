import { useNavigate } from "react-router";
import { useMe } from "@/hooks/use-me";
import { authClient } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { usePageTitle } from "@/contexts/page-header";

export function ProfilePage() {
  usePageTitle("Profile");
  const navigate = useNavigate();
  const { data: me, isPending, isError, refetch } = useMe();

  const handleLogout = async () => {
    await authClient.signOut();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col overflow-auto py-4">
      <p className="mb-4 text-[12px] text-muted-foreground">Your account details</p>

      <div className="max-w-sm space-y-4">
        {isPending ? (
          <div className="text-[13px] text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="flex items-center gap-3 text-[13px] text-destructive">
            Failed to load profile.
            <Button variant="outline" size="sm" className="h-7 text-[13px]" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : me ? (
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {me.fullName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-[13px] font-medium">{me.fullName}</p>
                {me.administrator && (
                  <p className="text-[11px] text-muted-foreground">Administrator</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-[13px] text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

ProfilePage.path = "/profile";
