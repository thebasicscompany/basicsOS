import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  CircleIcon,
  InfoIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getOnboardingChecklistItems } from "@/components/help/help-content";
import { useHelpCenter } from "@/hooks/use-help-center";
import { useOnboarding } from "@/hooks/use-onboarding";
import { cn } from "@/lib/utils";

function getStorageKey(userId: number) {
  return `crm:onboarding-checklist:${userId}`;
}

function readCheckedItems(userId: number | null): string[] {
  if (!userId || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

type HomeOnboardingChecklistProps = {
  userId: number | null | undefined;
  isAdmin: boolean;
  hasApiKey: boolean;
};

export function HomeOnboardingChecklist({
  userId,
  isAdmin,
  hasApiKey,
}: HomeOnboardingChecklistProps) {
  const navigate = useNavigate();
  const { openOnboarding } = useHelpCenter();
  const {
    hasCompletedOnboarding,
    hasSeenOnboarding,
    markOnboardingSeen,
    completeOnboarding,
    isCompletingOnboarding,
  } = useOnboarding();
  const items = useMemo(
    () => getOnboardingChecklistItems({ isAdmin, hasApiKey }),
    [hasApiKey, isAdmin],
  );
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  useEffect(() => {
    setCheckedIds(readCheckedItems(userId ?? null));
  }, [userId]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getStorageKey(userId),
      JSON.stringify(checkedIds),
    );
  }, [checkedIds, userId]);

  useEffect(() => {
    if (hasCompletedOnboarding || hasSeenOnboarding) {
      return;
    }

    void markOnboardingSeen().catch(() => {});
  }, [
    hasCompletedOnboarding,
    hasSeenOnboarding,
    markOnboardingSeen,
  ]);

  if (hasCompletedOnboarding || items.length === 0) {
    return null;
  }

  const completedCount = items.filter((item) => checkedIds.includes(item.id)).length;
  const progressValue = Math.round((completedCount / items.length) * 100);

  const toggleItem = (itemId: string) => {
    setCheckedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  };

  const handleTaskAction = (itemId: string, path: string) => {
    setCheckedIds((current) =>
      current.includes(itemId) ? current : [...current, itemId],
    );
    navigate(path);
  };

  const handleCompleteChecklist = async () => {
    try {
      await completeOnboarding();
      toast.success("Checklist hidden. You can reopen help any time.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update onboarding",
      );
    }
  };

  return (
    <Card className="mt-6 gap-0 rounded-2xl border py-0 shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <SparkleIcon className="size-3.5" />
                Getting started
              </Badge>
              <Badge variant="outline">
                {completedCount}/{items.length} done
              </Badge>
            </div>
            <CardTitle className="text-xl">
              A light checklist instead of a tour
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              Start with a few real actions so the product becomes familiar fast.
              {isAdmin
                ? " Admin-only setup stays in the checklist only where it actually belongs."
                : " Anything involving shared API access, organization setup, or member invites should stay with an admin."}
            </CardDescription>
          </div>
          <div className="w-full md:max-w-44">
            <Progress value={progressValue} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-6 py-5">
        {items.map((item, index) => {
          const checked = checkedIds.includes(item.id);

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                checked ? "border-primary/30 bg-primary/5" : "bg-surface-card",
              )}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-surface-hover",
                    )}
                    aria-label={checked ? "Mark item incomplete" : "Mark item complete"}
                  >
                    {checked ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <CircleIcon className="size-2.5 fill-current" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => handleTaskAction(item.id, item.action.path)}
                >
                  {item.action.label}
                </Button>
              </div>
            </div>
          );
        })}

        <Separator />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              This checklist is meant to guide, not block you. If you want a fuller
              explanation of how the app is organized, open the Help Center.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={openOnboarding}>
              Open Help Center
            </Button>
            <Button
              onClick={handleCompleteChecklist}
              disabled={isCompletingOnboarding}
            >
              {completedCount === items.length
                ? "Finish onboarding"
                : "Hide checklist"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
