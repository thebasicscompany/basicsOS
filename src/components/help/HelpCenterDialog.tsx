import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CaretRightIcon,
  ChatCircleIcon,
  GearIcon,
  HardDrivesIcon,
  HouseIcon,
  InfoIcon,
  MagnifyingGlassIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HELP_SHORTCUTS,
  getHelpTabs,
  getOnboardingChecklistItems,
  type HelpAction,
  type OnboardingChecklistItem,
  type HelpTab,
} from "@/components/help/help-content";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useMe } from "@/hooks/use-me";

export type HelpCenterMode = "help" | "onboarding";

type HelpCenterDialogProps = {
  open: boolean;
  mode: HelpCenterMode;
  onOpenChange: (open: boolean) => void;
  onReplayOnboarding: () => void;
};

const TAB_ICONS: Record<string, typeof InfoIcon> = {
  "start-here": HouseIcon,
  navigation: MagnifyingGlassIcon,
  assistant: ChatCircleIcon,
  "daily-work": HardDrivesIcon,
  setup: GearIcon,
};

function ActionButtons({
  actions,
  onNavigate,
}: {
  actions: HelpAction[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => (
        <button
          key={`${action.path}-${action.label}`}
          type="button"
          onClick={() => onNavigate(action.path)}
          className="rounded-lg border bg-surface-card p-4 text-left transition-colors hover:bg-surface-hover"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {action.label}
            </span>
            <CaretRightIcon className="size-3.5 text-muted-foreground" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {action.description}
          </p>
        </button>
      ))}
    </div>
  );
}

function ChecklistTabPanel({
  items,
  onNavigate,
}: {
  items: OnboardingChecklistItem[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="gap-0 rounded-xl border py-0">
        <CardHeader className="border-b px-6 py-5">
          <div className="flex items-center gap-2">
            <SparkleIcon className="size-4 text-muted-foreground" />
            <Badge variant="outline">Checklist</Badge>
          </div>
          <CardTitle className="text-xl">A low-pressure way to get started</CardTitle>
          <CardDescription className="text-sm leading-6">
            These are the first actions that usually make the product click:
            try voice, bring data in, and create a few real records. Admin-only
            setup stays separate from normal member onboarding.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item, index) => (
          <Card key={item.id} className="gap-0 rounded-xl border py-0">
            <CardHeader className="border-b px-6 py-5">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {String(index + 1).padStart(2, "0")}
                </Badge>
              </div>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription className="text-sm leading-6">
                {item.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <ActionButtons
                actions={[item.action]}
                onNavigate={onNavigate}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function HelpTabPanel({
  tab,
  onNavigate,
}: {
  tab: HelpTab;
  onNavigate: (path: string) => void;
}) {
  const Icon = TAB_ICONS[tab.id] ?? InfoIcon;

  return (
    <div className="space-y-4">
      <Card className="gap-0 rounded-xl border py-0">
        <CardHeader className="border-b px-6 py-5">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <Badge variant="outline">{tab.label}</Badge>
          </div>
          <CardTitle className="text-xl">{tab.title}</CardTitle>
          <CardDescription className="text-sm leading-6">
            {tab.description}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {tab.sections.map((section) => (
          <Card key={section.title} className="gap-0 rounded-xl border py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle className="text-base">{section.title}</CardTitle>
              <CardDescription className="text-sm leading-6">
                {section.body}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-6 py-5">
              <ul className="space-y-3">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-start gap-3 text-sm leading-6"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              {section.actions?.length ? (
                <>
                  <Separator />
                  <ActionButtons
                    actions={section.actions}
                    onNavigate={onNavigate}
                  />
                </>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ShortcutsPanel() {
  return (
    <div className="space-y-4">
      <Card className="gap-0 rounded-xl border py-0">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="text-xl">Shortcuts and faster paths</CardTitle>
          <CardDescription className="text-sm leading-6">
            These are the quickest ways to move around once you know the basics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6 py-5">
          {HELP_SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex flex-col gap-3 rounded-lg border bg-surface-card p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{shortcut.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shortcut.description}
                </p>
              </div>
              <KbdGroup className="shrink-0">
                {shortcut.keys.map((key) => (
                  <Kbd key={`${shortcut.label}-${key}`}>{key}</Kbd>
                ))}
              </KbdGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-0 rounded-xl border py-0">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle className="text-base">Home</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5 text-sm leading-6 text-muted-foreground">
            Use Home when you want to re-center on recent work, suggested follow-ups, and a fast way to start a new assistant prompt.
          </CardContent>
        </Card>
        <Card className="gap-0 rounded-xl border py-0">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle className="text-base">Search</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5 text-sm leading-6 text-muted-foreground">
            The command palette is the fastest recovery tool in the product when you know what you want but not exactly where it lives.
          </CardContent>
        </Card>
        <Card className="gap-0 rounded-xl border py-0">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle className="text-base">Help Center</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5 text-sm leading-6 text-muted-foreground">
            Reopen this anytime for the guided onboarding, navigation reminders, and setup guidance.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function HelpCenterDialog({
  open,
  mode,
  onOpenChange,
  onReplayOnboarding,
}: HelpCenterDialogProps) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [activeTab, setActiveTab] = useState("start-here");
  const { hasCompletedOnboarding, completeOnboarding, isCompletingOnboarding } =
    useOnboarding();
  const isAdmin = Boolean(me?.administrator);
  const hasApiKey = Boolean(me?.hasApiKey);
  const checklistItems = useMemo(
    () => getOnboardingChecklistItems({ isAdmin, hasApiKey }),
    [hasApiKey, isAdmin],
  );
  const helpTabs = useMemo(
    () => getHelpTabs({ isAdmin, hasApiKey }),
    [hasApiKey, isAdmin],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab(mode === "onboarding" ? "checklist" : "start-here");
  }, [mode, open]);

  const handleNavigate = useCallback(
    (path: string) => {
      onOpenChange(false);
      navigate(path);
    },
    [navigate, onOpenChange],
  );

  const handleFinishOnboarding = useCallback(async () => {
    try {
      await completeOnboarding();
      toast.success("Onboarding completed");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to complete onboarding",
      );
    }
  }, [completeOnboarding, onOpenChange]);

  const handleOpenChecklistTab = useCallback(() => {
    setActiveTab("checklist");
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] overflow-hidden p-0 sm:max-w-5xl">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b px-6 pt-6 pb-5 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Help Center</Badge>
              <Badge variant="outline">
                {hasCompletedOnboarding
                  ? "Checklist hidden"
                  : "Checklist available"}
              </Badge>
            </div>
            <DialogTitle className="text-2xl">Find your way around BasicsOS</DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-6">
              Use the checklist for a non-intrusive starting point, then dip into
              the rest of Help only when you want more context about the layout,
              AI features, or day-to-day workflows.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 px-6 py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="w-full overflow-x-auto lg:w-auto">
                    <TabsList className="h-auto w-max min-w-full justify-start rounded-xl p-1 lg:min-w-0">
                      <TabsTrigger value="checklist" className="min-w-fit px-3">
                        Checklist
                      </TabsTrigger>
                      {helpTabs.map((tab) => (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className="min-w-fit px-3"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                      <TabsTrigger value="shortcuts" className="min-w-fit px-3">
                        Shortcuts
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        handleOpenChecklistTab();
                        onReplayOnboarding();
                      }}
                    >
                      Open checklist
                    </Button>
                  </div>
                </div>

                <TabsContent value="checklist">
                  <ChecklistTabPanel
                    items={checklistItems}
                    onNavigate={handleNavigate}
                  />
                </TabsContent>

                {helpTabs.map((tab) => (
                  <TabsContent key={tab.id} value={tab.id}>
                    <HelpTabPanel tab={tab} onNavigate={handleNavigate} />
                  </TabsContent>
                ))}

                <TabsContent value="shortcuts">
                  <ShortcutsPanel />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t px-6 py-4">
            <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
              <InfoIcon className="size-4" />
              Help stays available from the sidebar and your user menu.
            </div>
            {!hasCompletedOnboarding ? (
              <Button
                variant="outline"
                onClick={handleFinishOnboarding}
                disabled={isCompletingOnboarding}
              >
                Hide checklist
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
