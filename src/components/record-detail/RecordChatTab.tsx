import { useRef, useState } from "react";
import { PaperclipIcon, XIcon, FileCsvIcon } from "@phosphor-icons/react";
import { useGatewayChat } from "@/hooks/useGatewayChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownContent } from "@/components/markdown-content";

/** A chat SCOPED to a CRM object (a whole grid) or — if recordId is given — one
 * record. The grid chat also accepts a DROPPED/attached CSV: the agent is told to
 * add any missing columns and import every row into this object. */
type Attachment = { name: string; mediaType: string; kind: "text"; content: string };

function msgText(m: { parts?: Array<{ type?: string; text?: string }>; content?: string }): string {
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }
  return m.content ?? "";
}

function readAsText(file: File): Promise<Attachment> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () =>
      resolve({
        name: file.name,
        mediaType: file.type || "text/csv",
        kind: "text",
        content: String(r.result ?? "").slice(0, 1_000_000),
      });
    r.onerror = () => resolve({ name: file.name, mediaType: "text/csv", kind: "text", content: "" });
    r.readAsText(file);
  });
}

const isTextFile = (f: File) =>
  /csv|text|tab-separated|json/.test(f.type) || /\.(csv|tsv|txt|json)$/i.test(f.name);

export function RecordChatTab({
  objectSlug,
  recordId,
  singular,
  plural,
}: {
  objectSlug: string;
  recordId?: number;
  singular: string;
  plural?: string;
}) {
  const { messages, append, status } = useGatewayChat({
    scope: recordId != null ? { object: objectSlug, recordId } : { object: objectSlug },
  });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = status === "streaming" || status === "submitted";
  const noun = (singular || "record").toLowerCase();
  const nounPlural = (plural || `${singular}s`).toLowerCase();

  const addFiles = async (files: FileList | File[]) => {
    const texts = Array.from(files).filter(isTextFile);
    if (!texts.length) return;
    const atts = await Promise.all(texts.map(readAsText));
    setPending((p) => [...p, ...atts]);
  };

  const send = () => {
    const text = input.trim();
    if ((!text && pending.length === 0) || busy) return;
    const atts = pending;
    setInput("");
    setPending([]);
    const msg =
      text ||
      `Import ${atts.map((a) => `"${a.name}"`).join(", ")} into my ${nounPlural}: read it, create any missing columns as fields on this object, then add every row. Tell me how many you imported.`;
    // experimental_attachments puts the file ON the message so it renders (with a
    // file icon + download) in the user's bubble; body.attachments carries the
    // full content to the server.
    const experimental_attachments = atts.map((a) => ({
      name: a.name,
      contentType: a.mediaType,
      url: URL.createObjectURL(new Blob([a.content], { type: a.mediaType })),
    }));
    void append(
      { role: "user", content: msg, experimental_attachments },
      atts.length ? { body: { attachments: atts } } : undefined,
    );
  };

  const visible = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const placeholder = recordId != null ? `Ask about this ${noun}…` : `Ask about your ${nounPlural}…`;
  const empty =
    recordId != null
      ? `Ask about this ${noun} — e.g. “summarize this record”, “set the category to electronics”. Only touches this record.`
      : `Ask anything about your ${nounPlural} — e.g. “how many in each category?”, “add a column for phone number”, or DROP A CSV here to import it (the assistant adds missing columns and imports every row).`;

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        if (recordId == null) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (recordId == null && e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
      }}
    >
      {dragOver ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
          Drop a CSV to import into your {nounPlural}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-1 py-1">
        {visible.length === 0 ? (
          <p className="px-1 text-sm leading-relaxed text-muted-foreground">{empty}</p>
        ) : (
          visible.map((m) => {
            const text = msgText(m);
            const atts = (
              m as { experimental_attachments?: Array<{ name?: string; contentType?: string; url?: string }> }
            ).experimental_attachments;
            return m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  {atts?.length ? (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {atts.map((a, i) => (
                        <a
                          key={`${a.name}-${i}`}
                          href={a.url}
                          download={a.name}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary-foreground/20 px-2 py-1 text-xs hover:bg-primary-foreground/30"
                        >
                          <FileCsvIcon className="size-3.5 shrink-0" />
                          <span className="max-w-[140px] truncate">{a.name}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {text ? <div className="whitespace-pre-wrap break-words">{text}</div> : null}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[92%] min-w-0 overflow-x-auto rounded-2xl bg-muted px-3.5 py-2 text-foreground">
                  {text ? (
                    <MarkdownContent>{text}</MarkdownContent>
                  ) : (
                    <span className="text-sm text-muted-foreground">{busy ? "Thinking…" : ""}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {pending.length > 0 ? (
        <div className="flex flex-wrap gap-2 pb-2">
          {pending.map((a, i) => (
            <span
              key={`${a.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs"
            >
              <FileCsvIcon className="size-3.5" />
              {a.name}
              <button
                type="button"
                aria-label="Remove file"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border pt-3"
      >
        {recordId == null ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.json,text/csv,text/plain"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              title="Attach a CSV"
              onClick={() => fileRef.current?.click()}
            >
              <PaperclipIcon className="size-4" />
            </Button>
          </>
        ) : null}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pending.length ? "Add a note (optional) and Send to import…" : placeholder}
          disabled={busy}
          className="flex-1"
        />
        <Button type="submit" className="shrink-0" disabled={busy || (!input.trim() && pending.length === 0)}>
          {busy ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
