"use client";

import { useState, useEffect } from "react";
import type { ComponentType, SVGProps } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/providers/AuthProvider";
import { readRecentRoutes } from "@/lib/recent-routes";
import type { RecentRoute } from "@/lib/recent-routes";
import { MODULE_ACCENTS } from "@basicsos/shared";
import type { ModuleId } from "@basicsos/shared";
import {
  cn,
  Card,
  Button,
  Badge,
  SectionLabel,
  IconBadge,
  EmptyState,
  BookOpen,
  Users,
  CheckSquare,
  Video,
  Link2,
  Sparkles,
  Settings,
  ShieldCheck,
  LayoutDashboard,
  Clock,
  Bot,
  X,
  ArrowRight,
  Inbox,
  DollarSign,
} from "@basicsos/ui";
import type { ComponentType, SVGProps } from "react";
import { useCommandPaletteContext } from "@/providers/CommandPaletteProvider";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

// Map MODULE_ACCENTS string icon names to actual Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Users,
  CheckSquare,
  Video,
  Link2,
  Sparkles,
  Settings,
  ShieldCheck,
};

// Extended accent info for modules not in MODULE_ACCENTS
const EXTRA_ACCENTS: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  admin: { label: "Admin", icon: "ShieldCheck", color: "text-stone-600", bg: "bg-stone-100" },
  settings: { label: "Settings", icon: "Settings", color: "text-stone-600", bg: "bg-stone-100" },
};

/** Dark-mode-aware icon badge colors for recent-work cards (and stat cards). */
const MODULE_ICON_COLORS: Record<string, string> = {
  knowledge: "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
  crm: "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
  tasks: "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  meetings: "bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",
  hub: "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400",
  assistant: "bg-primary/15 dark:bg-primary/20 text-primary",
  admin: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400",
  settings: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400",
};

const iconForModule = (moduleId: string | undefined): LucideIcon => {
  if (!moduleId) return LayoutDashboard;
  const accent = MODULE_ACCENTS[moduleId as ModuleId];
  if (accent) return ICON_MAP[accent.icon] ?? LayoutDashboard;
  const extra = EXTRA_ACCENTS[moduleId];
  if (extra) return ICON_MAP[extra.icon] ?? LayoutDashboard;
  return LayoutDashboard;
};

const colorForModule = (moduleId: string | undefined): string => {
  if (!moduleId) return "bg-secondary text-muted-foreground";
  return MODULE_ICON_COLORS[moduleId] ?? "bg-secondary text-muted-foreground";
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const relativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// --- Stat card (reference layout: icon in box, value, label) ---
function StatCard({
  title,
  value,
  href,
  Icon,
  iconColor,
}: {
  title: string;
  value: string;
  href: string;
  Icon: LucideIcon;
  iconColor: string;
}): JSX.Element {
  return (
    <a href={href} className="block">
      <Card className="p-4 transition-colors hover:bg-accent/50">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Icon className={cn("size-4", iconColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-semibold tabular-nums leading-tight text-foreground">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </Card>
    </a>
  );
}

// --- Zone 1: Recent Work Card ---

interface RecentWorkCardProps {
  route: RecentRoute;
  summary?: string | undefined;
}

const RecentWorkCard = ({ route, summary }: RecentWorkCardProps): JSX.Element => {
  const Icon = iconForModule(route.moduleId);
  const color = colorForModule(route.moduleId);

  return (
    <a href={route.path} className="block group">
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/50">
        <IconBadge Icon={Icon} size="md" color={color} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-foreground">
            {route.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary ?? relativeTime(route.timestamp)}
          </p>
        </div>
        <ArrowRight
          size={16}
          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </Card>
    </a>
  );
};

// --- Zone 2: Attention Item ---

interface AttentionItemData {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  body?: string | undefined;
  actionHref: string;
  dismissible: boolean;
}

const AttentionItem = ({
  item,
  onDismiss,
}: {
  item: AttentionItemData;
  onDismiss?: (() => void) | undefined;
}): JSX.Element => (
  <div className="flex items-center gap-3 py-2.5 first:pt-2 last:pb-2">
    <item.icon size={16} className={`shrink-0 ${item.iconColor}`} />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-foreground">{item.title}</p>
      {item.body && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.body}</p>}
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="sm" asChild>
        <a href={item.actionHref}>
          View
          <ArrowRight size={12} className="ml-1" />
        </a>
      </Button>
      {item.dismissible && onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <X size={14} />
        </Button>
      )}
    </div>
  </div>
);

// --- Page ---

// Next.js App Router requires default export — framework exception
const DashboardPage = (): JSX.Element => {
  const { user, isPending } = useAuth();
  const { setOpen: openSearch } = useCommandPaletteContext();
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);

  useEffect(() => {
    setRecentRoutes(readRecentRoutes());
  }, []);

  // Module summaries for recent work cards
  const { data: taskData } = trpc.tasks.list.useQuery({});
  const { data: contactData } = trpc.crm.contacts.list.useQuery({});
  const { data: dealData } = trpc.crm.deals.listByStage.useQuery();
  const { data: meetingData } = trpc.meetings.list.useQuery({ limit: 5 });
  const { data: docData } = trpc.knowledge.list.useQuery({ parentId: null });

  // Needs-attention data
  const { data: overdueTasks, isLoading: overdueLoading } = trpc.tasks.getOverdue.useQuery();
  const { data: aiJobs, isLoading: aiLoading } = trpc.aiEmployees.listJobs.useQuery();
  const { data: rawNotifications, isLoading: notifLoading } = trpc.notifications.list.useQuery();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const dismissMutation = trpc.notifications.dismiss.useMutation({
    onSuccess: (_data, variables) => {
      setDismissedIds((prev) => new Set([...prev, variables.id]));
    },
  });

  const firstName = isPending ? "" : (user?.name?.split(" ")[0] ?? "there");
  const visibleRecents = recentRoutes.slice(0, 4);
  const isAttentionLoading = overdueLoading || aiLoading || notifLoading;

  // Build contextual one-liners per module
  const summaryForModule = (moduleId: string | undefined): string | undefined => {
    switch (moduleId) {
      case "tasks": {
        const all = taskData ?? [];
        const inProgress = all.filter((t) => t.status === "in-progress").length;
        const todo = all.filter((t) => t.status === "todo").length;
        if (all.length === 0) return "No tasks yet";
        const parts: string[] = [];
        if (inProgress > 0) parts.push(`${inProgress} in progress`);
        if (todo > 0) parts.push(`${todo} to do`);
        return parts.length > 0 ? parts.join(" \u00b7 ") : `${all.length} tasks`;
      }
      case "crm": {
        const contacts = contactData?.length ?? 0;
        const deals = dealData?.flatMap((s) => s.deals).length ?? 0;
        if (contacts === 0 && deals === 0) return "No contacts or deals yet";
        const parts: string[] = [];
        if (contacts > 0) parts.push(`${contacts} contact${contacts === 1 ? "" : "s"}`);
        if (deals > 0) parts.push(`${deals} deal${deals === 1 ? "" : "s"}`);
        return parts.join(" \u00b7 ");
      }
      case "knowledge": {
        const docs = docData?.length ?? 0;
        if (docs === 0) return "No documents yet";
        return `${docs} document${docs === 1 ? "" : "s"}`;
      }
      case "meetings": {
        const meetings = meetingData ?? [];
        if (meetings.length === 0) return "No meetings recorded";
        return `${meetings.length} recent meeting${meetings.length === 1 ? "" : "s"}`;
      }
      case "hub":
        return "Links & integrations";
      case "assistant":
        return "AI-powered search";
      case "settings":
        return "Profile & preferences";
      case "admin":
        return "Team & configuration";
      default:
        return undefined;
    }
  };

  // Build attention items
  const attentionItems: AttentionItemData[] = [];

  // Unread notifications
  const unreadNotifications = (rawNotifications ?? []).filter(
    (n) => !n.read && !dismissedIds.has(n.id),
  );
  for (const n of unreadNotifications.slice(0, 5)) {
    attentionItems.push({
      id: `notif-${n.id}`,
      icon: Inbox,
      iconColor: "text-blue-500",
      title: n.title,
      body: n.body ?? undefined,
      actionHref: n.actionUrl ?? "/",
      dismissible: true,
    });
  }

  // Overdue tasks
  const overdueCount = overdueTasks?.length ?? 0;
  if (overdueCount > 0) {
    attentionItems.push({
      id: "overdue-tasks",
      icon: Clock,
      iconColor: "text-amber-500",
      title: overdueCount === 1 ? "1 overdue task" : `${overdueCount} overdue tasks`,
      actionHref: "/tasks",
      dismissible: false,
    });
  }

  // AI jobs awaiting approval
  const pendingJobs = (aiJobs ?? []).filter((j) => j.status === "awaiting_approval");
  if (pendingJobs.length > 0) {
    attentionItems.push({
      id: "ai-pending",
      icon: Bot,
      iconColor: "text-violet-500",
      title:
        pendingJobs.length === 1
          ? "AI employee output needs review"
          : `${pendingJobs.length} AI outputs need review`,
      actionHref: "/assistant",
      dismissible: false,
    });
  }

  const handleDismiss = (item: AttentionItemData): void => {
    const notifId = item.id.replace("notif-", "");
    dismissMutation.mutate({ id: notifId });
  };

  const taskCount = taskData?.length ?? 0;
  const contactCount = contactData?.length ?? 0;
  const dealCount = dealData?.flatMap((s) => s.deals).length ?? 0;
  const meetingCount = meetingData?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Title row — breadcrumb already shows "Dashboard", so only subtitle + badge here */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Overview of your workspace
        </p>
        <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
          Last updated: just now
        </Badge>
      </div>

      {/* Stat cards — reference: 4 cards, icon top-left in box, value, label */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tasks"
          value={String(taskCount)}
          href="/tasks"
          Icon={CheckSquare}
          iconColor="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Contacts"
          value={String(contactCount)}
          href="/crm"
          Icon={Users}
          iconColor="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Deals"
          value={String(dealCount)}
          href="/crm?view=pipeline"
          Icon={DollarSign}
          iconColor="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        />
        <StatCard
          title="Meetings"
          value={String(meetingCount)}
          href="/meetings"
          Icon={Video}
          iconColor="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
        />
      </div>

      {/* Two-column layout on large screens */}
      <div className="grid gap-8 lg:grid-cols-[1fr,340px]">
        {/* Zone 1: Resume */}
        <section>
          <SectionLabel as="h2" className="mb-4">
            Pick up where you left off
          </SectionLabel>

          {visibleRecents.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleRecents.map((route, i) => (
                <RecentWorkCard
                  key={`${route.path}-${i}`}
                  route={route}
                  summary={summaryForModule(route.moduleId)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              Icon={LayoutDashboard}
              heading="Start exploring"
              description="Navigate to any module from the sidebar and your recent work will appear here."
              className="py-12"
            />
          )}
        </section>

        {/* Zone 2: Needs Attention */}
        <section className="lg:order-none">
          <SectionLabel as="h2" className="mb-3">
            Needs attention
          </SectionLabel>

          {isAttentionLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-sm bg-stone-100 dark:bg-stone-800" />
              ))}
            </div>
          ) : attentionItems.length > 0 ? (
            <Card className="divide-y divide-border px-4 py-0">
              {attentionItems.map((item) => (
                <AttentionItem
                  key={item.id}
                  item={item}
                  onDismiss={item.dismissible ? () => handleDismiss(item) : undefined}
                />
              ))}
            </Card>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              All caught up — nothing needs your attention.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
