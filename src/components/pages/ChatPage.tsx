"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { Message } from "@ai-sdk/react";
import { FileTextIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { usePageTitle } from "@/contexts/page-header";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ToolSteps, type ToolStep } from "@/components/ai-elements/tool-steps";
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
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputProvider,
} from "@/components/ai-elements/prompt-input";
import { Suggestion } from "@/components/ai-elements/suggestion";
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

const SUGGESTIONS = [
  "What are my latest deals?",
  "Create a task for following up",
  "Add a note to my top contact",
  "Summarize my pipeline",
  "Who are my hot contacts?",
  "What's the status of my deals?",
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
  return result;
}

function extractToolSteps(message: { annotations?: unknown[] }): ToolStep[] {
  const annotations = (
    message as { annotations?: Array<Record<string, unknown>> }
  ).annotations;
  if (!annotations) return [];
  const steps: ToolStep[] = [];
  for (const ann of annotations) {
    if (ann.type === "tool_start") {
      steps.push({
        id: ann.id as string,
        toolName: ann.toolName as string,
        args: ann.args as string[] | undefined,
        status: "running",
      });
    } else if (ann.type === "tool_result") {
      const existing = steps.find((s) => s.id === ann.id);
      if (existing) {
        existing.status = (ann.success as boolean) ? "complete" : "error";
        existing.result = ann.result as string | undefined;
      } else {
        steps.push({
          id: ann.id as string,
          toolName: ann.toolName as string,
          result: ann.result as string | undefined,
          status: (ann.success as boolean) ? "complete" : "error",
        });
      }
    }
  }
  return steps;
}

const CRM_LINK_ALLOWED_TAGS: Record<string, string[]> = {
  "crm-link": ["path"],
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

const crmComponents = { "crm-link": CrmLinkTag };

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

interface DataFileAttachment {
  name: string;
  content: string;
}

const DATA_FILE_ACCEPT = ".csv,.json,.txt";
const DATA_FILE_MAX_SIZE = 512 * 1024; // 512KB
const DATA_FILE_CONTENT_LIMIT = 10_000; // chars

function DataFileChip({
  attachment,
  onRemove,
}: {
  attachment: DataFileAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 py-1 pl-2 pr-1 text-xs font-medium">
      <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="max-w-[200px] truncate">{attachment.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
        aria-label="Remove file"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

function DataFileAttachButton({
  onAttach,
}: {
  onAttach: (file: DataFileAttachment) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > DATA_FILE_MAX_SIZE) {
        toast.error("File too large. Maximum size is 512KB.");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        let content = reader.result as string;

        // For JSON files, try to format nicely
        if (file.name.endsWith(".json")) {
          try {
            content = JSON.stringify(JSON.parse(content), null, 2);
          } catch {
            // Keep as-is if not valid JSON
          }
        }

        onAttach({
          name: file.name,
          content: content.slice(0, DATA_FILE_CONTENT_LIMIT),
        });
      };
      reader.readAsText(file);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [onAttach],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={DATA_FILE_ACCEPT}
        className="hidden"
        onChange={handleFileSelect}
        aria-label="Attach data file"
      />
      <PromptInputButton
        tooltip="Attach file (.csv, .json, .txt)"
        onClick={() => fileInputRef.current?.click()}
      >
        <PaperclipIcon className="size-4" />
      </PromptInputButton>
    </>
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
  const { data: savedMessages } = useThreadMessages(threadId);
  const [dataFile, setDataFile] = useState<DataFileAttachment | null>(null);

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

  const appendedFromHomeRef = useRef(false);
  useEffect(() => {
    const state = location.state as { initialText?: string } | null;
    const text = state?.initialText?.trim();
    if (!text || !threadId || appendedFromHomeRef.current) return;
    appendedFromHomeRef.current = true;
    navigate(location.pathname, { replace: true, state: {} });
    append({ role: "user", content: text });
  }, [threadId, location.state, location.pathname, navigate, append]);

  const allVisible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );
  const isEmpty = allVisible.length === 0;
  const isIdle = status === "ready";

  // Hide page title on empty starter screen
  usePageTitle(isEmpty && isIdle ? "" : "AI Chat");

  const handleSubmit = useCallback(
    async (
      message: PromptInputMessage,
      _event: React.FormEvent<HTMLFormElement>,
    ) => {
      if (!hasKey) {
        toast.error("Add your Basics API key in Settings to use the assistant");
        return;
      }
      const userText = message.text?.trim() || "";
      const hasText = Boolean(userText);
      const hasFile = Boolean(dataFile);
      if (!hasText && !hasFile) return;

      let content = userText;
      if (dataFile) {
        const filePrefix = `[Attached file: ${dataFile.name}]\n${dataFile.content}\n\n`;
        content = filePrefix + content;
        setDataFile(null);
      }

      await append({ role: "user", content });
    },
    [append, hasKey, dataFile],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      append({ role: "user", content: suggestion });
    },
    [append],
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
        <PromptInputProvider>
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
              <PromptInput onSubmit={handleSubmit}>
                {dataFile && (
                  <PromptInputHeader>
                    <DataFileChip
                      attachment={dataFile}
                      onRemove={() => setDataFile(null)}
                    />
                  </PromptInputHeader>
                )}
                <PromptInputBody>
                  <PromptInputTextarea placeholder="Ask anything about your operating system..." />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    <DataFileAttachButton onAttach={setDataFile} />
                  </PromptInputTools>
                  <PromptInputSubmit status={status} onStop={stop} />
                </PromptInputFooter>
              </PromptInput>
            </div>
            {hasKey && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={handleSuggestionClick}
                  />
                ))}
              </div>
            )}
          </div>
        </PromptInputProvider>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PromptInputProvider>
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="pb-2">
            {displayMessages.map((m) => {
              const toolSteps =
                m.role === "assistant" ? extractToolSteps(m) : [];
              return (
                <MessageEl key={m.id} from={m.role as "user" | "assistant"}>
                  <MessageContent>
                    {toolSteps.length > 0 && <ToolSteps steps={toolSteps} />}
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
              );
            })}
            {isThinking && (
              <MessageEl from="assistant">
                <MessageContent>
                  <Shimmer className="text-[13px]">Thinking...</Shimmer>
                </MessageContent>
              </MessageEl>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="shrink-0 px-4 pb-6 pt-2">
          <PromptInput onSubmit={handleSubmit}>
            {dataFile && (
              <PromptInputHeader>
                <DataFileChip
                  attachment={dataFile}
                  onRemove={() => setDataFile(null)}
                />
              </PromptInputHeader>
            )}
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask anything about your operating system..." />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <DataFileAttachButton onAttach={setDataFile} />
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
      </PromptInputProvider>
    </div>
  );
}

export function ChatPage() {
  const { threadId } = useParams<{ threadId?: string }>();
  // Key forces remount when switching threads
  return <ChatPageInner key={threadId ?? "new"} threadId={threadId} />;
}
