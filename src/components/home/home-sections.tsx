import { type ReactNode, useMemo } from "react";
import { Link } from "react-router";
import type { ComponentType } from "react";
import {
  ArrowRightIcon,
  ChatCircleIcon,
  ClockIcon,
  LightningIcon,
  RobotIcon,
  UserPlusIcon,
  PencilSimpleIcon,
  WarningCircleIcon,
  SpinnerGapIcon,
  NoteIcon,
  MicrophoneIcon,
  PlugIcon,
  GearIcon,
  NotePencilIcon,
  ListChecksIcon,
} from "@phosphor-icons/react";
import { useRecentPages } from "@/hooks/use-recent-pages";
import { useThreads, type Thread } from "@/hooks/use-threads";
import { useRecords } from "@/hooks/use-records";
import { getObjectIcon } from "@/lib/object-icon-map";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import {
  useEmailSyncStatus,
  useSuggestedContacts,
  useAcceptSuggestion,
  useDismissSuggestion,
} from "@/hooks/use-email-sync";
import { SuggestedContactCard } from "@/components/email-sync/SuggestedContactCard";

/* ------------------------------------------------------------------ */
/*  Shared UI                                                         */
/* ------------------------------------------------------------------ */

function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        {count != null && count > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function SectionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      <ArrowRightIcon className="size-3" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity feed types                                               */
/* ------------------------------------------------------------------ */

type ActivityKind =
  | "agent_chat"
  | "automation_success"
  | "automation_error"
  | "automation_running"
  | "record_created"
  | "record_updated"
  | "note_added";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  timestamp: string;
  href?: string;
}

const ACTIVITY_META: Record<
  ActivityKind,
  {
    icon: ComponentType<{ className?: string }>;
    accent: string;
    statusColor?: string;
  }
> = {
  agent_chat: {
    icon: RobotIcon,
    accent: "bg-primary/15 text-primary dark:bg-primary/10",
  },
  automation_success: {
    icon: LightningIcon,
    accent:
      "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    statusColor: "bg-emerald-500 dark:bg-emerald-400",
  },
  automation_error: {
    icon: WarningCircleIcon,
    accent: "bg-red-500/15 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    statusColor: "bg-red-500 dark:bg-red-400",
  },
  automation_running: {
    icon: SpinnerGapIcon,
    accent:
      "bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    statusColor: "bg-amber-500 dark:bg-amber-400",
  },
  record_created: {
    icon: UserPlusIcon,
    accent:
      "bg-blue-500/15 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  },
  record_updated: {
    icon: PencilSimpleIcon,
    accent:
      "bg-violet-500/15 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
  },
  note_added: {
    icon: NoteIcon,
    accent:
      "bg-orange-500/15 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  },
};

/* ------------------------------------------------------------------ */
/*  Section: Recents (activity feed)                                  */
/* ------------------------------------------------------------------ */

// Set to true to preview the Recents section with mock data
const USE_MOCK_ACTIVITY = false;

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "mock-1",
    kind: "agent_chat",
    title: "Summarized pipeline for Q1",
    detail: "AI Chat",
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    href: "/chat",
  },
  {
    id: "mock-2",
    kind: "automation_success",
    title: "Welcome email to new leads",
    detail: "Completed",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    href: "/automations",
  },
  {
    id: "mock-3",
    kind: "record_created",
    title: "Sarah Chen",
    detail: "Contact created",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    href: "/objects/contacts/1",
  },
  {
    id: "mock-4",
    kind: "automation_error",
    title: "Slack notification on deal close",
    detail: "Webhook timeout after 30s",
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    href: "/automations",
  },
  {
    id: "mock-5",
    kind: "record_updated",
    title: "Acme Corp — Enterprise Plan",
    detail: "Deal stage changed to Negotiation",
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    href: "/objects/deals/1",
  },
  {
    id: "mock-6",
    kind: "agent_chat",
    title: "Draft follow-up for Johnson & Co",
    detail: "AI Chat",
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    href: "/chat",
  },
];

interface AutomationRun {
  id: number;
  ruleId: number;
  status: string;
  result?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  ruleName?: string;
}

function useActivityFeed(): { items: ActivityItem[]; isLoading: boolean } {
  // Always call hooks unconditionally (React rules of hooks)
  const { data: automationRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ["home-automation-runs"],
    queryFn: () =>
      fetchApi<AutomationRun[]>("/api/automation-runs?limit=5&sort=desc"),
    staleTime: 30_000,
    enabled: !USE_MOCK_ACTIVITY,
  });

  const { data: threads, isLoading: loadingThreads } = useThreads(
    USE_MOCK_ACTIVITY ? 0 : 3,
  );

  const { data: contactsData } = useRecords("contacts", {
    page: 1,
    perPage: 3,
    sort: { field: "created_at", order: "DESC" },
  });
  const { data: dealsData } = useRecords("deals", {
    page: 1,
    perPage: 3,
    sort: { field: "created_at", order: "DESC" },
  });
  const { data: companiesData } = useRecords("companies", {
    page: 1,
    perPage: 3,
    sort: { field: "created_at", order: "DESC" },
  });
  const { data: contactNotesData } = useRecords("contact_notes", {
    page: 1,
    perPage: 3,
    sort: { field: "date", order: "DESC" },
  });
  const { data: dealNotesData } = useRecords("deal_notes", {
    page: 1,
    perPage: 3,
    sort: { field: "date", order: "DESC" },
  });

  const items = useMemo(() => {
    if (USE_MOCK_ACTIVITY) return MOCK_ACTIVITY;
    const feed: ActivityItem[] = [];

    // AI chat threads → agent_chat
    for (const t of threads ?? []) {
      if (t.channel !== "chat") continue;
      feed.push({
        id: `thread-${t.id}`,
        kind: "agent_chat",
        title: t.title ?? "AI conversation",
        detail: "AI Chat",
        timestamp: t.updatedAt,
        href: `/chat/${t.id}`,
      });
    }

    // Automation runs → automation_success/error/running
    for (const run of automationRuns ?? []) {
      const kind: ActivityKind =
        run.status === "success"
          ? "automation_success"
          : run.status === "error"
            ? "automation_error"
            : "automation_running";
      feed.push({
        id: `run-${run.id}`,
        kind,
        title: run.ruleName ?? `Automation #${run.ruleId}`,
        detail:
          run.status === "error"
            ? (run.error?.slice(0, 60) ?? "Failed")
            : run.status === "running"
              ? "In progress..."
              : "Completed",
        timestamp: run.finishedAt ?? run.startedAt,
        href: "/automations",
      });
    }

    // Recently created contacts → record_created
    for (const r of (contactsData?.data ?? []).slice(0, 2)) {
      const rec = r as Record<string, unknown>;
      const id = (rec.id ?? rec.Id) as number;
      if (id == null) continue;
      const firstName = (rec.firstName ?? rec.first_name ?? "") as string;
      const lastName = (rec.lastName ?? rec.last_name ?? "") as string;
      const name =
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        ((rec.FullName ??
          rec.full_name ??
          rec.Name ??
          rec.name ??
          "") as string);
      const createdAt = (rec.createdAt ??
        rec.created_at ??
        rec.CreatedAt ??
        "") as string;
      if (!name) continue;
      feed.push({
        id: `contact-${id}`,
        kind: "record_created",
        title: name,
        detail: "Contact created",
        timestamp: createdAt || new Date().toISOString(),
        href: `/objects/contacts/${id}`,
      });
    }

    // Recently created deals → record_created
    for (const r of (dealsData?.data ?? []).slice(0, 2)) {
      const rec = r as Record<string, unknown>;
      const id = (rec.id ?? rec.Id) as number;
      if (id == null) continue;
      const name = (rec.Name ??
        rec.name ??
        rec.Title ??
        rec.title ??
        "") as string;
      const createdAt = (rec.createdAt ??
        rec.created_at ??
        rec.CreatedAt ??
        "") as string;
      if (!name) continue;
      feed.push({
        id: `deal-${id}`,
        kind: "record_created",
        title: name,
        detail: "Deal created",
        timestamp: createdAt || new Date().toISOString(),
        href: `/objects/deals/${id}`,
      });
    }

    // Recently created companies → record_created
    for (const r of (companiesData?.data ?? []).slice(0, 2)) {
      const rec = r as Record<string, unknown>;
      const id = (rec.id ?? rec.Id) as number;
      if (id == null) continue;
      const name = (rec.name ??
        rec.Name ??
        rec.title ??
        rec.Title ??
        "") as string;
      const createdAt = (rec.createdAt ??
        rec.created_at ??
        rec.CreatedAt ??
        "") as string;
      if (!name) continue;
      feed.push({
        id: `company-${id}`,
        kind: "record_created",
        title: name,
        detail: "Company created",
        timestamp: createdAt || new Date().toISOString(),
        href: `/objects/companies/${id}`,
      });
    }

    // Recently added contact notes → note_added
    for (const r of (contactNotesData?.data ?? []).slice(0, 2)) {
      const rec = r as Record<string, unknown>;
      const id = (rec.id ?? rec.Id) as number;
      const contactId = (rec.contactId ?? rec.contact_id) as number;
      const title = (rec.title ?? rec.Title ?? "") as string;
      const text = (rec.text ?? rec.Text ?? "") as string;
      const date = (rec.date ??
        rec.Date ??
        rec.createdAt ??
        rec.created_at ??
        "") as string;
      const name =
        title || (typeof text === "string" ? text.slice(0, 50) : "") || "Note";
      if (id == null) continue;
      feed.push({
        id: `contact-note-${id}`,
        kind: "note_added",
        title: name,
        detail: "Contact note",
        timestamp: date || new Date().toISOString(),
        href: contactId ? `/objects/contacts/${contactId}` : undefined,
      });
    }

    // Recently added deal notes → note_added
    for (const r of (dealNotesData?.data ?? []).slice(0, 2)) {
      const rec = r as Record<string, unknown>;
      const id = (rec.id ?? rec.Id) as number;
      const dealId = (rec.dealId ?? rec.deal_id) as number;
      const title = (rec.title ?? rec.Title ?? "") as string;
      const text = (rec.text ?? rec.Text ?? "") as string;
      const date = (rec.date ??
        rec.Date ??
        rec.createdAt ??
        rec.created_at ??
        "") as string;
      const name =
        title || (typeof text === "string" ? text.slice(0, 50) : "") || "Note";
      if (id == null) continue;
      feed.push({
        id: `deal-note-${id}`,
        kind: "note_added",
        title: name,
        detail: "Deal note",
        timestamp: date || new Date().toISOString(),
        href: dealId ? `/objects/deals/${dealId}` : undefined,
      });
    }

    // Sort all by timestamp descending
    feed.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Deduplicate by id
    const seen = new Set<string>();
    return feed
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 6);
  }, [
    threads,
    automationRuns,
    contactsData,
    dealsData,
    companiesData,
    contactNotesData,
    dealNotesData,
  ]);

  return {
    items,
    isLoading: USE_MOCK_ACTIVITY ? false : loadingRuns || loadingThreads,
  };
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = ACTIVITY_META[item.kind];
  const Icon = meta.icon;
  const timeAgo = getTimeAgo(item.timestamp);

  const content = (
    <div className="group flex items-start gap-3 rounded-lg px-3.5 py-2.5 transition-all hover:bg-accent/50">
      <div
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${meta.accent}`}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm">{item.title}</p>
          {meta.statusColor && (
            <span
              className={`size-1.5 shrink-0 rounded-full ${meta.statusColor}`}
            />
          )}
        </div>
        {item.detail && (
          <p className="truncate text-[11px] text-muted-foreground">
            {item.detail}
          </p>
        )}
      </div>
      <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">
        {timeAgo}
      </span>
    </div>
  );

  if (item.href) {
    return <Link to={item.href}>{content}</Link>;
  }
  return content;
}

export function RecentsSection() {
  const { items, isLoading } = useActivityFeed();

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-3">
        <SectionHeader title="Recents" />
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg px-3.5 py-2.5"
            >
              <div className="size-7 shrink-0 animate-pulse rounded-md bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader title="Recents" />
      <div className="-mx-3.5 space-y-0.5">
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Continue Working On (recently visited pages/platforms)    */
/* ------------------------------------------------------------------ */

/** Map well-known icon keys to Phosphor icons */
const PAGE_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  chat: ChatCircleIcon,
  automations: LightningIcon,
  tasks: ListChecksIcon,
  notes: NotePencilIcon,
  voice: MicrophoneIcon,
  mcp: PlugIcon,
  settings: GearIcon,
};

function getPageIcon(iconSlug: string): ComponentType<{ className?: string }> {
  return PAGE_ICON_MAP[iconSlug] ?? getObjectIcon(iconSlug);
}

const PAGE_ACCENT: Record<string, string> = {
  chat: "bg-primary/15 text-primary dark:bg-primary/10",
  automations:
    "bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  tasks:
    "bg-orange-500/15 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  notes: "bg-teal-500/15 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
  voice: "bg-pink-500/15 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
  mcp: "bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  settings: "bg-muted text-muted-foreground",
};

function getPageAccent(iconSlug: string): string {
  if (PAGE_ACCENT[iconSlug]) return PAGE_ACCENT[iconSlug];
  // For object-registry icons, use a default CRM accent
  return "bg-blue-500/15 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400";
}

export function RecentRecordsSection() {
  const [recentPages] = useRecentPages();

  if (recentPages.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader title="Continue Working On" />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {recentPages.slice(0, 4).map((page) => {
          const Icon = getPageIcon(page.icon);
          const accent = getPageAccent(page.icon);

          return (
            <Link
              key={page.key}
              to={page.path}
              className="group flex items-center gap-3 rounded-lg bg-card px-3.5 py-3 transition-all hover:bg-accent"
            >
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-md ${accent}`}
              >
                <Icon className="size-4" />
              </div>
              <p className="min-w-0 truncate text-sm font-medium">
                {page.label}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Recent chat threads                                      */
/* ------------------------------------------------------------------ */

export function RecentChatsSection() {
  const { data: threads } = useThreads(5);
  const recentThreads = (threads ?? [])
    .filter((t) => t.channel === "chat")
    .slice(0, 3);

  if (recentThreads.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40 p-3">
      <SectionHeader
        title="Recent Chats"
        count={recentThreads.length}
        action={<SectionLink to="/chat" label="New chat" />}
      />
      <div className="mt-3 space-y-1.5">
        {recentThreads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} />
        ))}
      </div>
    </div>
  );
}

function ThreadRow({ thread }: { thread: Thread }) {
  const timeAgo = getTimeAgo(thread.updatedAt);
  return (
    <Link
      to={`/chat/${thread.id}`}
      className="group flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition-all hover:bg-muted/50"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary dark:bg-primary/10">
        <ChatCircleIcon className="size-4" />
      </div>
      <p className="min-w-0 flex-1 truncate text-sm">
        {thread.title ?? "Untitled chat"}
      </p>
      <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
        <ClockIcon className="size-3" />
        {timeAgo}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Suggested contacts from email sync                       */
/* ------------------------------------------------------------------ */

export function SuggestedContactsSection() {
  const { data: syncStatus } = useEmailSyncStatus();
  const pending = syncStatus?.pendingSuggestions ?? 0;
  const { data } = useSuggestedContacts({
    status: "pending",
    page: 1,
    perPage: 4,
  });
  const suggestions = data?.data ?? [];
  const acceptMutation = useAcceptSuggestion();
  const dismissMutation = useDismissSuggestion();

  if (pending === 0 || suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader
        title="Contacts from your email"
        count={pending}
        action={<SectionLink to="/objects/contacts" label="View all" />}
      />
      <div className="-mx-3.5 space-y-0.5">
        {suggestions.slice(0, 4).map((suggestion) => (
          <SuggestedContactCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccept={(id) => acceptMutation.mutate(id)}
            onDismiss={(id) => dismissMutation.mutate(id)}
            isAccepting={
              acceptMutation.isPending &&
              acceptMutation.variables === suggestion.id
            }
            isDismissing={
              dismissMutation.isPending &&
              dismissMutation.variables === suggestion.id
            }
            compact
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
