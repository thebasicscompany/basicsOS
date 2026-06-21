"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  PlugIcon,
  CurrencyDollarIcon,
  LightningIcon,
  GlobeIcon,
  EnvelopeSimpleIcon,
  DownloadSimpleIcon,
  FileIcon,
  type Icon,
} from "@phosphor-icons/react";
import { getRuntimeApiUrl } from "@/lib/runtime-config";

const CHAT_API_URL = getRuntimeApiUrl();
import type { Message } from "@ai-sdk/react";
import { motion, AnimatePresence } from "motion/react";
import { usePageTitle } from "@/contexts/page-header";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
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
  PromptInputTextarea,
  PromptInputTools,
  PromptInputProvider,
} from "@/components/ai-elements/prompt-input";
import { usePromptInputAttachments, useOptionalPromptInputController } from "@/components/ai-elements/prompt-input-context";
import { useGatewayChat } from "@/hooks/useGatewayChat";
import { useGateway } from "@/hooks/useGateway";
import { useThreadMessages } from "@/hooks/use-threads";
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
  return result;
}

// Files the agent generated come through as [file:NAME](/api/files/<thread>/<name>).
const DOWNLOAD_RE = /\[file:([^\]]+)\]\((\/api\/files\/[^)]+)\)/g;
function rewriteDownloadChips(text: string): string {
  if (!text.includes("/api/files/")) return text;
  return text.replace(DOWNLOAD_RE, (_m, name: string, path: string) => {
    return `<download-chip url="${path}" name="${name}"></download-chip>`;
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
  "download-chip": ["url", "name"],
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
  const name = (props.name as string | undefined) || "file";
  if (!url) return null;
  return (
    <a
      href={`${CHAT_API_URL}${url}`}
      target="_blank"
      rel="noreferrer"
      className="not-prose my-1 inline-flex max-w-full items-center gap-2 rounded-[--surface-card-radius] border bg-surface-card px-3 py-2 align-middle text-[13px] no-underline transition-colors hover:bg-surface-hover"
    >
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{name}</span>
      <DownloadSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
    </a>
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

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
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

      const text = message.text?.trim() || "Sent with attachments";
      if (hasAttachments) {
        toast.success("Files attached", {
          description: `${message.files!.length} file(s) attached. Note: The assistant currently supports text only.`,
        });
      }
      // Clear the input immediately so the textarea empties before the response arrives.
      controller?.textInput.clear();
      // Fire-and-forget: returning void (not a Promise) causes PromptInput
      // to clear the textarea immediately instead of waiting for the response.
      void append({ role: "user", content: text });
    },
    [append, hasKey, controller],
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
      <div className="flex h-full flex-col items-center justify-center overflow-hidden">
        <div className="-mt-24 flex w-full max-w-2xl flex-col items-center gap-5 px-6">
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
