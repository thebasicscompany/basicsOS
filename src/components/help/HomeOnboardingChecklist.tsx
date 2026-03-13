import { useEffect, useMemo, useState } from "react";
import {
  CaretDownIcon,
  CaretUpIcon,
  CheckIcon,
  InfoIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
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
import { readWizardCompletedSteps } from "@/lib/wizard-storage";
import { useHelpCenter } from "@/hooks/use-help-center";
import { useOnboarding } from "@/hooks/use-onboarding";
import { cn } from "@/lib/utils";

import { getRuntimeApiUrl } from "@/lib/runtime-config";
const API_URL = getRuntimeApiUrl();

type Connection = {
  provider: string;
};

function getVisitedKey(userId: number) {
  return `crm:onboarding-visited:${userId}`;
}

function readVisitedItems(userId: number | null | undefined): string[] {
  if (!userId || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getVisitedKey(userId));
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
  const [expanded, setExpanded] = useState(true);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [wizardCompletedIds, setWizardCompletedIds] = useState<string[]>([]);
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () =>
      fetch(`${API_URL}/api/connections`, { credentials: "include" }).then((r) =>
        r.ok ? (r.json() as Promise<Connection[]>) : [],
      ),
    enabled: hasApiKey,
  });

  useEffect(() => {
    setVisitedIds(readVisitedItems(userId));
    if (userId) setWizardCompletedIds(readWizardCompletedSteps(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getVisitedKey(userId), JSON.stringify(visitedIds));
  }, [userId, visitedIds]);

  const completedIds = useMemo(() => {
    const connectedProviders = new Set(connections.map((connection) => connection.provider));
    const ids = new Set<string>([...visitedIds, ...wizardCompletedIds]);

    if (connectedProviders.has("google")) ids.add("connect-gmail");
    // If voice-setup was visited or shortcuts were configured, mark configure-shortcuts done
    if (ids.has("shortcuts") || ids.has("voice-setup")) ids.add("configure-shortcuts");

    return ids;
  }, [connections, visitedIds, wizardCompletedIds]);

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

  const completedCount = items.filter((item) => completedIds.has(item.id)).length;
  const progressValue = Math.round((completedCount / items.length) * 100);
  const remainingCount = items.length - completedCount;

  const handleTaskAction = (itemId: string, path: string) => {
    setVisitedIds((current) =>
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
    <Card className="gap-0 rounded-2xl border py-0 shadow-sm">
      <CardHeader className="px-5 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
              <CardTitle className="text-base">
                A few quick first steps
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                {remainingCount > 0
                  ? `You have ${remainingCount} suggested ${remainingCount === 1 ? "task" : "tasks"} left.`
                  : "You’ve cleared the suggested checklist."}{" "}
                {isAdmin
                  ? "Shared setup stays with you as the admin."
                  : "Shared API, org changes, and invites stay with your admin."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? (
                  <>
                    Collapse
                    <CaretUpIcon className="size-4" />
                  </>
                ) : (
                  <>
                    View checklist
                    <CaretDownIcon className="size-4" />
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={openOnboarding}>
                Help Center
              </Button>
            </div>
          </div>

          <div className="w-full">
            <Progress value={progressValue} />
          </div>

          {!expanded ? (
            <div className="flex flex-wrap gap-2">
              {items.slice(0, 3).map((item) => {
                const checked = completedIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setExpanded(true)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      checked
                        ? "border-primary/30 bg-primary/5 text-foreground"
                        : "bg-surface-card text-muted-foreground hover:bg-surface-hover",
                    )}
                  >
                    {checked ? (
                      <CheckIcon className="size-3.5" />
                    ) : (
                      <span className="size-2 rounded-full bg-current opacity-70" />
                    )}
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </CardHeader>

      {expanded ? (
        <>
          <Separator />
          <CardContent className="space-y-3 px-5 py-4">
            {items.map((item, index) => {
              const checked = completedIds.has(item.id);

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
                      <div
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {checked ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          <span className="size-2 rounded-full bg-current opacity-70" />
                        )}
                      </div>

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
                      {checked ? "Revisit" : item.action.label}
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
        </>
      ) : null}
    </Card>
  );
}
