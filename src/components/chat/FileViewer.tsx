"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { DownloadSimpleIcon, FileIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import { getRuntimeApiUrl } from "@/lib/runtime-config";

const API_URL = getRuntimeApiUrl();

export interface ViewerFile {
  url: string; // path like /api/files/<thread>/<name>
  name: string;
}

const ext = (n: string) => n.slice(n.lastIndexOf(".") + 1).toLowerCase();
const TEXT = new Set(["md", "markdown", "txt", "log", "json", "csv", "html", "htm", "xml", "yaml", "yml"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"]);

/** A Claude.ai-style right-side panel that previews a generated file by type. */
export function FileViewer({ file, onClose }: { file: ViewerFile | null; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e = file ? ext(file.name) : "";
  const fullUrl = file ? `${API_URL}${file.url}` : "";

  useEffect(() => {
    if (!file) return;
    setText(null);
    setError(null);
    setBlobUrl(null);
    const kind = TEXT.has(e) ? "text" : IMAGE.has(e) || e === "pdf" ? "binary" : "none";
    if (kind === "none") return; // office docs etc. -> download only
    setLoading(true);
    let revoked: string | null = null;
    fetch(fullUrl, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Couldn't load file (${r.status})`);
        return kind === "text" ? r.text().then((t) => ({ t })) : r.blob().then((b) => ({ b }));
      })
      .then((res) => {
        if ("t" in res) setText(res.t);
        else {
          revoked = URL.createObjectURL(res.b);
          setBlobUrl(revoked);
        }
      })
      .catch((err) => setError(err.message ?? "Couldn't load file"))
      .finally(() => setLoading(false));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [file, fullUrl, e]);

  return (
    <Sheet open={!!file} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="flex-row items-center justify-between gap-3 border-b px-4 py-3">
          <SheetTitle className="flex min-w-0 items-center gap-2 text-sm">
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{file?.name}</span>
          </SheetTitle>
          {file && (
            <a href={fullUrl} target="_blank" rel="noreferrer" className="shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <DownloadSimpleIcon className="size-4" /> Download
              </Button>
            </a>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <SpinnerGapIcon className="size-5 animate-spin" />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!loading && !error && file && (
            <FileBody ext={e} name={file.name} text={text} blobUrl={blobUrl} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FileBody({
  ext: e,
  name,
  text,
  blobUrl,
}: {
  ext: string;
  name: string;
  text: string | null;
  blobUrl: string | null;
}) {
  if (IMAGE.has(e) && blobUrl) {
    return <img src={blobUrl} alt={name} className="mx-auto max-w-full rounded-md" />;
  }
  if (e === "pdf" && blobUrl) {
    return <iframe src={blobUrl} title={name} className="h-full min-h-[70vh] w-full rounded-md border" />;
  }
  if (e === "md" || e === "markdown") {
    return <MarkdownContent>{text ?? ""}</MarkdownContent>;
  }
  if (e === "csv" && text != null) {
    return <CsvTable text={text} />;
  }
  if (e === "html" || e === "htm") {
    return (
      <iframe
        title={name}
        sandbox=""
        srcDoc={text ?? ""}
        className="h-full min-h-[70vh] w-full rounded-md border bg-white"
      />
    );
  }
  if (TEXT.has(e) && text != null) {
    return (
      <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
        {text}
      </pre>
    );
  }
  // docx / pptx / xlsx and anything else we can't render inline.
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <FileIcon className="size-8" />
      <p className="text-sm font-medium text-foreground">Preview not available for .{e}</p>
      <p className="max-w-xs text-xs">Use Download above to open this file in its app.</p>
    </div>
  );
}

function CsvTable({ text }: { text: string }) {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = (parsed.data as string[][]).slice(0, 500);
  if (!rows.length) return <p className="text-sm text-muted-foreground">Empty file.</p>;
  const [head, ...body] = rows;
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border-b bg-muted/40 px-2 py-1.5 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="hover:bg-surface-hover">
              {r.map((c, ci) => (
                <td key={ci} className="border-b px-2 py-1.5 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
