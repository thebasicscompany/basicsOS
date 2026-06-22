"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  PlugIcon,
  CurrencyDollarIcon,
  LightningIcon,
  GlobeIcon,
  EnvelopeSimpleIcon,
  ArrowSquareOutIcon,
  FileIcon,
  FileTextIcon,
  FileCsvIcon,
  FilePdfIcon,
  XIcon,
  MagnifyingGlassIcon,
  ChatCircleIcon,
  MicrophoneIcon,
  type Icon,
} from "@phosphor-icons/react";
import { FileViewer, type ViewerFile } from "@/components/chat/FileViewer";
import type { Message } from "@ai-sdk/react";
import { motion, AnimatePresence } from "motion/react";
import { usePageTitle } from "@/contexts/page-header";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message as MessageEl,
  MessageContent,
  MessageResponse,
  type MessageResponseProps,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputButton,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputProvider,
} from "@/components/ai-elements/prompt-input";
import { usePromptInputAttachments, useOptionalPromptInputController } from "@/components/ai-elements/prompt-input-context";
import { useGatewayChat } from "@/hooks/useGatewayChat";
import { useGateway } from "@/hooks/useGateway";
import { useThreadMessages, useThreads } from "@/hooks/use-threads";
import { Input } from "@/components/ui/input";
import { useRecords } from "@/hooks/use-records";

function getTextContent(msg: {
  content?: unknown;
  parts?: Array<{ type: string; text?: string }>;
}): string {
  if (msg.parts) {
    return msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  const content = msg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  return "";
}

const SUGGESTIONS: Array<{ icon: Icon; label: string; prompt: string }> = [
  { icon: CurrencyDollarIcon, label: "Summarize my pipeline", prompt: "Summarize my open deals and their total value" },
  { icon: LightningIcon, label: "Set up an automation", prompt: "Every Monday at 8am, email me a summary of my open deals" },
  { icon: GlobeIcon, label: "Research an account", prompt: "Find recent news about my top account and summarize it" },
  { icon: EnvelopeSimpleIcon, label: "Draft a follow-up", prompt: "Draft a follow-up email to my most recent contact" },
];

const WIKI_LINK_RE = /\[\[([a-z][a-z0-9-]*)\/(\d+)(#\w+)?\|([^\]]+)\]\]/g;
const MD_LINK_RE = /\[([^\]]+)\]\((\/objects\/[^)]+|\/automations\/[^)]+)\)/g;

function rewriteCrmLinks(text: string): string {
  let result = text.replace(
    WIKI_LINK_RE,
    (
      _match,
      slug: string,
      id: string,
      hash: string | undefined,
      label: string,
    ) =>
      `<crm-link path="/objects/${slug}/${id}${hash ?? ""}">${label}</crm-link>`,
  );
  result = result.replace(MD_LINK_RE, (_match, label: string, path: string) => {
    if (result.includes(`>${label}</crm-link>`)) return _match;
    return `<crm-link path="${path}">${label}</crm-link>`;
  });
  result = rewriteConnectCards(result);
  result = rewriteDownloadChips(result);
  result = stripUnsafeLinks(result);
  return result;
}

// The agent sometimes also hand-writes a markdown link to a generated file using
// a bare/relative or sandbox: href; Streamdown renders those as "[blocked]". Our
// real affordances (crm-link, connect-card, download-chip) are already converted
// to tags above and our routes start with "/", so anything still pointing at a
// non-http, non-root href is unsafe noise — drop the link, keep the text.
const UNSAFE_LINK_RE = /\[([^\]]+)\]\((?!https?:\/\/|\/|mailto:)[^)]*\)/g;
function stripUnsafeLinks(text: string): string {
  return text.replace(UNSAFE_LINK_RE, (_m, label: string) => label);
}

// Files the agent generated come through as [file:NAME](/api/files/<thread>/<name>).
const DOWNLOAD_RE = /\[file:([^\]]+)\]\((\/api\/files\/[^)]+)\)/g;
function rewriteDownloadChips(text: string): string {
  if (!text.includes("/api/files/")) return text;
  return text.replace(DOWNLOAD_RE, (_m, name: string, path: string) => {
    // Use `fname` not `name`: Streamdown/rehype namespaces id/name attrs with a
    // "user-content-" prefix, which would leak into the visible label.
    return `<download-chip url="${path}" fname="${name}"></download-chip>`;
  });
}

// Composio connect/authorize URLs are a fixed domain — turn them (whether the
// agent wrote them as a markdown link or a bare URL) into a styled connect card.
const CONNECT_URL = "https://backend.composio.dev/";
const CONNECT_MD_LINK_RE = /\[([^\]]+)\]\((https:\/\/backend\.composio\.dev\/[^)]+)\)/g;
const CONNECT_BARE_RE = /(?<![("=])(https:\/\/backend\.composio\.dev\/[^\s)]+)/g;

function appFromLabel(label: string): string {
  const cleaned = label.replace(/\b(connect|authorize|sign\s*in( to)?|link|here|now|to|your|account|the)\b/gi, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.replace(/^\w/, (c) => c.toUpperCase()) : "your account";
}

function rewriteConnectCards(text: string): string {
  if (!text.includes(CONNECT_URL)) return text;
  let result = text.replace(CONNECT_MD_LINK_RE, (_m, label: string, url: string) => {
    return `<connect-card url="${url}" app="${appFromLabel(label)}"></connect-card>`;
  });
  result = result.replace(CONNECT_BARE_RE, (_m, url: string) => {
    return `<connect-card url="${url}" app="your account"></connect-card>`;
  });
  return result;
}

const CRM_LINK_ALLOWED_TAGS: Record<string, string[]> = {
  "crm-link": ["path"],
  "connect-card": ["url", "app"],
  "download-chip": ["url", "fname"],
};

const OBJECT_RECORD_RE = /^\/objects\/([a-z][a-z0-9-]*)\/(.+)$/;

function CrmLinkTag(props: Record<string, unknown>) {
  const navigate = useNavigate();
  const path = props.path as string | undefined;

  const handleClick = useCallback(() => {
    if (!path) return;
    const m = OBJECT_RECORD_RE.exec(path);
    if (m) {
      const [, slug, recordPart] = m;
      const idPart = recordPart.split("#")[0];
      if (/^\d+$/.test(idPart)) {
        navigate(path);
      } else {
        navigate(`/objects/${slug}`);
        toast.info(
          "Opened the list — the assistant generated an invalid record link",
        );
      }
      return;
    }
    navigate(path);
  }, [navigate, path]);

  return (
    <span
      className="crm-link"
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
    >
      {props.children as React.ReactNode}
    </span>
  );
}

function ConnectCardTag(props: Record<string, unknown>) {
  const url = props.url as string | undefined;
  const app = (props.app as string | undefined) || "your account";
  if (!url) return null;
  return (
    <span className="not-prose my-2 flex items-center gap-3 rounded-[--surface-card-radius] border bg-surface-card p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <PlugIcon className="size-4" weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-tight">Connect {app}</span>
        <span className="block text-[11px] text-muted-foreground">Authorize access so the agent can finish this for you.</span>
      </span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
      >
        Connect
      </a>
    </span>
  );
}

function DownloadChipTag(props: Record<string, unknown>) {
  const url = props.url as string | undefined;
  const name = (props.fname as string | undefined) || "file";
  if (!url) return null;
  // Click opens the in-app viewer (which has a Download button); decoupled from
  // the deep Streamdown tree via a window event the ChatPage listens for.
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("bos:open-file", { detail: { url, name } }))}
      className="not-prose my-1 inline-flex max-w-full items-center gap-2 rounded-[--surface-card-radius] border bg-surface-card px-3 py-2 align-middle text-[13px] transition-colors hover:bg-surface-hover"
    >
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{name}</span>
      <ArrowSquareOutIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

const crmComponents = {
  "crm-link": CrmLinkTag,
  "connect-card": ConnectCardTag,
  "download-chip": DownloadChipTag,
};

function EntityAwareMessageResponse({
  children,
  ...props
}: MessageResponseProps) {
  const processed = useMemo(() => {
    if (typeof children !== "string") return children;
    return rewriteCrmLinks(children);
  }, [children]);

  return (
    <div className="chat-message-content">
      <MessageResponse
        {...props}
        allowedTags={CRM_LINK_ALLOWED_TAGS}
        components={crmComponents}
      >
        {processed}
      </MessageResponse>
    </div>
  );
}

function iconForAttachment(mediaType?: string, name?: string): Icon {
  const m = mediaType || "";
  const n = (name || "").toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return FilePdfIcon;
  if (m === "text/csv" || n.endsWith(".csv")) return FileCsvIcon;
  if (m.startsWith("text/") || /\.(md|markdown|txt|json|log|ya?ml|html?|xml|js|ts|py|sql)$/.test(n)) return FileTextIcon;
  return FileIcon;
}

// Renders uploaded files inside a sent user message bubble (image thumbnails,
// type chips), from the message's experimental_attachments.
function MessageAttachments({
  message,
}: {
  message: { experimental_attachments?: Array<{ name?: string; contentType?: string; url?: string }> };
}) {
  const atts = message.experimental_attachments;
  if (!atts?.length) return null;
  return (
    <div className="not-prose mb-2 flex flex-wrap gap-2">
      {atts.map((a, i) => {
        const name = a.name || "file";
        const isImage = (a.contentType || "").startsWith("image/") && !!a.url;
        const Icon = iconForAttachment(a.contentType, name);
        return isImage ? (
          <img key={i} src={a.url} alt={name} className="size-16 rounded-md border object-cover" />
        ) : (
          <span
            key={i}
            className="inline-flex max-w-[200px] items-center gap-1.5 rounded-md border bg-surface-card px-2 py-1 text-[12px]"
            title={name}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{name}</span>
          </span>
        );
      })}
    </div>
  );
}

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-1 pb-1">
      {attachments.files.map((a) => {
        const data = a as { id: string; url?: string; filename?: string; mediaType?: string };
        const name = data.filename || "file";
        const isImage = (data.mediaType || "").startsWith("image/") && !!data.url;
        const Icon = iconForAttachment(data.mediaType, name);
        return (
          <div
            key={data.id}
            className="group relative flex max-w-[220px] items-center gap-2 rounded-[--surface-card-radius] border bg-surface-card py-1.5 pl-1.5 pr-7"
            title={name}
          >
            {isImage ? (
              <img src={data.url} alt={name} className="size-9 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4 text-muted-foreground" />
              </span>
            )}
            <span className="truncate text-[12px] font-medium">{name}</span>
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => attachments.remove(data.id)}
              className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-surface-hover group-hover:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function useRecentHint() {
  const deals = useRecords("deals", {
    perPage: 1,
    sort: { field: "created_at", order: "DESC" },
  });
  const tasks = useRecords("tasks", {
    perPage: 1,
    sort: { field: "created_at", order: "DESC" },
  });

  return useMemo(() => {
    const latestDeal = deals.data?.data?.[0] as
      | Record<string, unknown>
      | undefined;
    const latestTask = tasks.data?.data?.[0] as
      | Record<string, unknown>
      | undefined;

    if (latestDeal) {
      const name = (latestDeal.name ?? latestDeal.title ?? "") as string;
      if (name) return `Ask about "${name}" or anything else`;
    }
    if (latestTask) {
      const text = (latestTask.text ?? latestTask.title ?? "") as string;
      if (text) return `Ask about "${text}" or anything else`;
    }
    return null;
  }, [deals.data, tasks.data]);
}

function relativeChatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d` : new Date(iso).toLocaleDateString();
}

/** Searchable list of the user's chats, shown on the main chat landing. */
function RecentChatsHub() {
  const navigate = useNavigate();
  const { data: threads } = useThreads(100);
  const [q, setQ] = useState("");
  const all = (threads ?? []).filter((t) => t.channel === "chat" || t.channel === "voice");
  if (all.length === 0) return null;
  const query = q.trim().toLowerCase();
  const filtered = query ? all.filter((t) => (t.title ?? "Untitled").toLowerCase().includes(query)) : all;
  return (
    <div className="w-full max-w-xl space-y-2 text-left">
      <h2 className="text-[13px] font-medium text-muted-foreground">Your chats</h2>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your chats…"
          className="h-9 pl-8"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="max-h-72 space-y-0.5 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No chats match “{q}”.</p>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/chat/${t.id}`)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover"
            >
              {t.channel === "voice" ? (
                <MicrophoneIcon className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChatCircleIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{t.title ?? "Untitled"}</span>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{relativeChatTime(t.updatedAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ChatPageInner({ threadId }: { threadId?: string }) {
  const { hasKey } = useGateway();
  const recentHint = useRecentHint();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: savedMessages } = useThreadMessages(threadId);

  const initialMessages = useMemo<Message[] | undefined>(() => {
    if (!savedMessages || savedMessages.length === 0) return undefined;
    return savedMessages.map((m) => ({
      id: String(m.id),
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));
  }, [savedMessages]);

  const { messages, append, status, stop } = useGatewayChat({
    initialThreadId: threadId,
    initialMessages,
  });

  // Tracks the last context string that was auto-sent to prevent double-sends
  // on re-renders, while still allowing NEW context strings (e.g. a second
  // meeting follow-up) to trigger a fresh send even if we're already on /chat.
  const lastAppendedContextRef = useRef<string | null>(null);
  useEffect(() => {
    const state = location.state as { initialText?: string } | null;
    const contextFromUrl = searchParams.get("context")?.trim();
    const text = (state?.initialText ?? contextFromUrl)?.trim();
    if (!text || text === lastAppendedContextRef.current) return;
    lastAppendedContextRef.current = text;
    if (contextFromUrl) {
      setSearchParams({}, { replace: true });
    } else {
      navigate(location.pathname, { replace: true, state: {} });
    }
    append({ role: "user", content: text });
  }, [threadId, location.state, location.pathname, navigate, append, searchParams, setSearchParams]);

  const allVisible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  const isEmpty = allVisible.length === 0;
  const isIdle = status === "ready";

  // Hide page title on empty starter screen
  usePageTitle(isEmpty && isIdle ? "" : "AI Chat");

  // Animation variants
  const userMsgVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
  };
  const assistantMsgVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
  };
  const thinkingVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: "easeOut" } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };

  const controller = useOptionalPromptInputController();

  // Web-search toggle (chat bar): when on, the message is prefixed to force the
  // agent to use web.search. Lightweight, client-only — the agent can search
  // anyway, this just makes the intent explicit.
  const [webSearch, setWebSearch] = useState(false);

  // In-app file viewer: download chips dispatch "bos:open-file"; open the panel.
  const [viewerFile, setViewerFile] = useState<ViewerFile | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as ViewerFile | undefined;
      if (detail?.url) setViewerFile(detail);
    };
    window.addEventListener("bos:open-file", onOpen as EventListener);
    return () => window.removeEventListener("bos:open-file", onOpen as EventListener);
  }, []);

  // Send a turn, reading any uploaded files so the AGENT actually receives them:
  // images go to gpt-4o vision; text files (md/csv/txt/json/code) are inlined.
  // Attachments ride in the request body and the server builds hermes content.
  const sendMessage = useCallback(
    async (text: string, files?: Array<{ url?: string; filename?: string; mediaType?: string }>) => {
      if (!files?.length) {
        append({ role: "user", content: text });
        return;
      }
      const attachments = (
        await Promise.all(
          files.map(async (f) => {
            try {
              if (!f.url) return null;
              const blob = await (await fetch(f.url)).blob();
              const name = f.filename || "file";
              const mediaType = f.mediaType || blob.type || "application/octet-stream";
              const toDataUrl = () =>
                new Promise<string>((res, rej) => {
                  const r = new FileReader();
                  r.onload = () => res(r.result as string);
                  r.onerror = rej;
                  r.readAsDataURL(blob);
                });
              if (mediaType.startsWith("image/")) {
                return { name, mediaType, kind: "image" as const, content: await toDataUrl() };
              }
              if (mediaType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
                // server extracts the text via unpdf
                return { name, mediaType, kind: "pdf" as const, content: await toDataUrl() };
              }
              if (/officedocument/.test(mediaType) || /\.(docx|xlsx|pptx)$/i.test(name)) {
                // server extracts the text via officeparser
                return { name, mediaType, kind: "office" as const, content: await toDataUrl() };
              }
              const texty =
                mediaType.startsWith("text/") ||
                /\.(md|markdown|txt|csv|json|tsv|log|ya?ml|html?|xml|js|ts|py|sql)$/i.test(name) ||
                mediaType === "application/json";
              if (texty) {
                const t = await blob.text();
                return { name, mediaType, kind: "text" as const, content: t.slice(0, 200_000) };
              }
              return { name, mediaType, kind: "unsupported" as const, content: "" };
            } catch {
              return null;
            }
          }),
        )
      ).filter(Boolean);
      // experimental_attachments puts the files ON the message so they render in
      // the user's bubble; the body.attachments carry the full content to the server.
      append(
        {
          role: "user",
          content: text,
          experimental_attachments: files.map((f) => ({
            name: f.filename ?? "file",
            contentType: f.mediaType,
            url: f.url ?? "",
          })),
        },
        { body: { attachments } },
      );
    },
    [append],
  );

  const handleSubmit = useCallback(
    (
      message: PromptInputMessage,
      _event: React.FormEvent<HTMLFormElement>,
    ) => {
      if (!hasKey) {
        toast.error("Add your Basics API key in Settings to use the assistant");
        return;
      }
      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);
      if (!(hasText || hasAttachments)) return;

      const base = message.text?.trim() || "Sent with attachments";
      const text = webSearch ? `Use web search to answer this. ${base}` : base;
      // Clear the input immediately so the textarea empties before the response arrives.
      controller?.textInput.clear();
      // Fire-and-forget: returning void (not a Promise) causes PromptInput
      // to clear the textarea immediately instead of waiting for the response.
      void sendMessage(text, message.files);
    },
    [sendMessage, hasKey, controller, webSearch],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!hasKey) {
        toast.error("Add your Basics API key in Settings to use the assistant");
        return;
      }
      // Never discard what the user already typed: if the input has text, drop
      // the suggestion into the box so they review/edit and send it deliberately
      // (so the sent message always matches the input). Only quick-send from an
      // empty input.
      const typed = controller?.textInput.value?.trim();
      if (typed) {
        controller?.textInput.setInput(suggestion);
        return;
      }
      append({ role: "user", content: suggestion });
    },
    [append, hasKey, controller],
  );

  const lastMsg = allVisible.at(-1);
  const lastAssistantIsEmpty =
    lastMsg?.role === "assistant" && !getTextContent(lastMsg);
  const isThinking =
    status === "submitted" || (status === "streaming" && lastAssistantIsEmpty);
  const displayMessages =
    isThinking && lastAssistantIsEmpty ? allVisible.slice(0, -1) : allVisible;

  if (isEmpty && isIdle) {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 px-6 py-10">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-foreground">
              What can I help with?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {!hasKey
                ? "Add your Basics API key in Settings to get started."
                : (recentHint ?? "Ask anything about your operating system.")}
            </p>
          </div>
          <div className="w-full">
            <PromptInput globalDrop multiple onSubmit={handleSubmit}>
              <PromptInputHeader>
                <PromptInputAttachmentsDisplay />
              </PromptInputHeader>
              <PromptInputBody>
                <PromptInputTextarea placeholder="Ask anything about your operating system..." />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  <PromptInputButton
                    tooltip="Search the web"
                    variant={webSearch ? "default" : "ghost"}
                    aria-pressed={webSearch}
                    onClick={() => setWebSearch((v) => !v)}
                  >
                    <GlobeIcon className="size-4" />
                  </PromptInputButton>
                </PromptInputTools>
                <PromptInputSubmit status={status} onStop={stop} />
              </PromptInputFooter>
            </PromptInput>
          </div>
          {hasKey && (
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map(({ icon: SuggestionIcon, label, prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSuggestionClick(prompt)}
                  className="flex items-start gap-3 rounded-[--surface-card-radius] border bg-surface-card p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SuggestionIcon className="size-4" weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-tight">{label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{prompt}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {hasKey && <RecentChatsHub />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} />
      <Conversation className="min-h-0 flex-1">
          <ConversationContent className="pb-2">
            {displayMessages.map((m) => (
              <motion.div
                key={m.id}
                variants={m.role === "user" ? userMsgVariants : assistantMsgVariants}
                initial="hidden"
                animate="visible"
                layout="position"
              >
                <MessageEl from={m.role as "user" | "assistant"}>
                  <MessageContent>
                    <MessageAttachments message={m} />
                    <EntityAwareMessageResponse
                      animated={
                        m.role === "assistant"
                          ? { animation: "blurIn" }
                          : undefined
                      }
                      isAnimating={
                        m.role === "assistant" && status === "streaming"
                      }
                    >
                      {getTextContent(m)}
                    </EntityAwareMessageResponse>
                  </MessageContent>
                </MessageEl>
              </motion.div>
            ))}
            <AnimatePresence mode="wait">
              {isThinking && (
                <motion.div
                  key="thinking"
                  variants={thinkingVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <MessageEl from="assistant">
                    <MessageContent>
                      <Shimmer className="text-[13px]">Thinking...</Shimmer>
                    </MessageContent>
                  </MessageEl>
                </motion.div>
              )}
            </AnimatePresence>
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="shrink-0 px-4 pb-6 pt-2">
          <PromptInput globalDrop multiple onSubmit={handleSubmit}>
            <PromptInputHeader>
              <PromptInputAttachmentsDisplay />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask anything about your operating system..." />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputButton
                  tooltip="Search the web"
                  variant={webSearch ? "default" : "ghost"}
                  aria-pressed={webSearch}
                  onClick={() => setWebSearch((v) => !v)}
                >
                  <GlobeIcon className="size-4" />
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit
                status={status}
                onStop={stop}
                variant="ghost"
                className="rounded-full"
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
    </div>
  );
}

export function ChatPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  // PromptInputProvider is lifted here so ChatPageInner can call
  // useOptionalPromptInputController() to clear the input immediately on submit.
  return (
    <PromptInputProvider>
      <ChatPageInner key={threadId ?? "new"} threadId={threadId} />
    </PromptInputProvider>
  );
}
