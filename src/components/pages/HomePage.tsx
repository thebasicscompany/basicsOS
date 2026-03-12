import { useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router";
import { ChatCircleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { useGateway } from "@/hooks/useGateway";
import { useThreads } from "@/hooks/use-threads";
import {
  RecentsSection,
  RecentRecordsSection,
  RecentChatsSection,
  SuggestedContactsSection,
  DealOpportunitiesSection,
  UnreviewedMeetingsSection,
} from "@/components/home/home-sections";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { HomeOnboardingChecklist } from "@/components/help/HomeOnboardingChecklist";

const API_URL = import.meta.env.VITE_API_URL ?? "";

/* ------------------------------------------------------------------ */
/*  Greeting                                                          */
/* ------------------------------------------------------------------ */

const GREETINGS = [
  (name: string, tod: string) => `${tod}, ${name}.`,
  (name: string) => `Welcome back, ${name}.`,
  (name: string) => `What's on the agenda, ${name}?`,
  (name: string) => `Ready when you are, ${name}.`,
  (name: string) => `Let's make it happen, ${name}.`,
  (name: string) => `What can I help with, ${name}?`,
  (name: string, tod: string) => `${tod}, ${name}. What's next?`,
  (name: string) => `Hey ${name}, let's get to work.`,
];

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getGreeting(name: string) {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      86400000,
  );
  const idx = dayOfYear % GREETINGS.length;
  return GREETINGS[idx]!(name, getTimeOfDay());
}

/* ------------------------------------------------------------------ */
/*  Home sections config                                              */
/*  Add, remove, or reorder sections here.                            */
/* ------------------------------------------------------------------ */

const HOME_SECTIONS = [
  { id: "deal-opportunities", component: DealOpportunitiesSection },
  { id: "suggested-contacts", component: SuggestedContactsSection },
  { id: "unreviewed-meetings", component: UnreviewedMeetingsSection },
  { id: "recent-records", component: RecentRecordsSection },
  { id: "recents", component: RecentsSection },
  { id: "recent-chats", component: RecentChatsSection },
] as const;

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function HomePage() {
  const { data: me } = useMe();
  const { hasKey } = useGateway();
  const { data: threads } = useThreads(1);
  const navigate = useNavigate();

  const firstName = me?.firstName || me?.fullName?.split(" ")[0] || "there";
  const greeting = useMemo(() => getGreeting(firstName), [firstName]);
  const recentThread = threads?.[0] ?? null;

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text) return;
      if (!hasKey) {
        toast.error("Add your Basics API key in Settings to use the assistant");
        return;
      }

      const res = await fetch(`${API_URL}/api/gateway-chat/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "chat" }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Failed to start chat");
        return;
      }
      const { threadId } = (await res.json()) as { threadId: string };
      navigate(`/chat/${threadId}`, {
        state: { initialText: text } as { initialText: string },
      });
    },
    [hasKey, navigate],
  );

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-6 pt-2 pb-16">
        {/* Greeting */}
        <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>

        {/* Chat section */}
        <div className="mt-5">
          {/* Recent chat strip */}
          {recentThread && (
            <Link
              to={`/chat/${recentThread.id}`}
              className="flex items-center gap-2 rounded-t-xl bg-muted/60 dark:bg-muted px-4 pt-2.5 pb-5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/80 dark:hover:bg-muted/80"
            >
              <ChatCircleIcon className="size-3.5" />
              <span>Recent chat</span>
              <span className="mx-0.5 text-border">·</span>
              <span className="font-medium text-foreground truncate max-w-[300px]">
                {recentThread.title ?? "Untitled"}
              </span>
              <svg
                className="ml-auto size-3.5 opacity-50"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          )}

          {/* Chat input card */}
          <PromptInput
            onSubmit={handleSubmit}
            className={`rounded-xl shadow-sm ${recentThread ? "-mt-3 relative z-10" : ""}`}
          >
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask anything..." />
            </PromptInputBody>
            <PromptInputFooter>
              <div />
              <PromptInputSubmit />
            </PromptInputFooter>
          </PromptInput>
        </div>

        <div className="mt-6">
          <HomeOnboardingChecklist
            userId={me?.id}
            isAdmin={Boolean(me?.administrator)}
            hasApiKey={hasKey || Boolean(me?.hasApiKey)}
          />
        </div>

        {/* Dynamic sections */}
        <div className="mt-8 space-y-8">
          {HOME_SECTIONS.map(({ id, component: Section }) => (
            <Section key={id} />
          ))}
        </div>
      </div>
    </div>
  );
}
