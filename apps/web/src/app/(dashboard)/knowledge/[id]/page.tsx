"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { addToast } from "@basicsos/ui";

const AUTOSAVE_MS = 1500;

type ToolbarButton = {
  label: string;
  title: string;
  action: () => void;
  active: () => boolean;
};

// Next.js page — requires default export
const DocumentDetailPage = (): JSX.Element => {
  const params = useParams();
  const router = useRouter();
  const id = params["id"] as string;

  const utils = trpc.useUtils();
  const { data: doc, error, isLoading } = trpc.knowledge.get.useQuery({ id });

  const updateMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      void utils.knowledge.list.invalidate();
    },
    onError: (err) => {
      addToast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const [localTitle, setLocalTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to always-current save so keyboard/timer callbacks never go stale
  const saveRef = useRef<(titleOverride?: string) => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    onUpdate: () => {
      setIsDirty(true);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => saveRef.current(), AUTOSAVE_MS);
    },
  });

  // Load content once both doc and editor are ready
  useEffect(() => {
    if (!doc || !editor || editor.isDestroyed) return;
    setLocalTitle(doc.title);
    if (doc.contentJson) {
      editor.commands.setContent(
        doc.contentJson as Parameters<typeof editor.commands.setContent>[0],
        false, // false = don't fire onUpdate, so loading doesn't mark dirty
      );
    }
    // Only re-run when the document ID or editor instance changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, editor]);

  const save = useCallback(
    (titleOverride?: string): void => {
      if (!editor || editor.isDestroyed || !doc) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      updateMutation.mutate({
        id,
        title: titleOverride ?? localTitle,
        contentJson: editor.getJSON() as Record<string, unknown>,
      });
      setIsDirty(false);
    },
    [editor, doc, id, localTitle, updateMutation],
  );

  // Keep ref in sync with latest save closure
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Cmd+S / Ctrl+S — uses ref so no deps needed
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Flush autosave on unmount
  useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    },
    [],
  );

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        {error.message}
      </div>
    );
  }

  if (isLoading || !doc) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-stone-200" />
        <div className="h-10 w-2/3 rounded bg-stone-200" />
        <div className="h-96 rounded-xl bg-stone-100" />
      </div>
    );
  }

  const saving = updateMutation.isPending;
  const statusText = saving ? "Saving…" : isDirty ? "Unsaved changes" : "Saved";

  const toolbarButtons: (ToolbarButton | null)[] = [
    {
      label: "B",
      title: "Bold",
      action: () => editor?.chain().focus().toggleBold().run(),
      active: () => editor?.isActive("bold") ?? false,
    },
    {
      label: "I",
      title: "Italic",
      action: () => editor?.chain().focus().toggleItalic().run(),
      active: () => editor?.isActive("italic") ?? false,
    },
    {
      label: "S̶",
      title: "Strikethrough",
      action: () => editor?.chain().focus().toggleStrike().run(),
      active: () => editor?.isActive("strike") ?? false,
    },
    null,
    {
      label: "H1",
      title: "Heading 1",
      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
      active: () => editor?.isActive("heading", { level: 1 }) ?? false,
    },
    {
      label: "H2",
      title: "Heading 2",
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => editor?.isActive("heading", { level: 2 }) ?? false,
    },
    {
      label: "H3",
      title: "Heading 3",
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      active: () => editor?.isActive("heading", { level: 3 }) ?? false,
    },
    null,
    {
      label: "•",
      title: "Bullet list",
      action: () => editor?.chain().focus().toggleBulletList().run(),
      active: () => editor?.isActive("bulletList") ?? false,
    },
    {
      label: "1.",
      title: "Ordered list",
      action: () => editor?.chain().focus().toggleOrderedList().run(),
      active: () => editor?.isActive("orderedList") ?? false,
    },
    null,
    {
      label: "</>",
      title: "Code block",
      action: () => editor?.chain().focus().toggleCodeBlock().run(),
      active: () => editor?.isActive("codeBlock") ?? false,
    },
    {
      label: "`",
      title: "Inline code",
      action: () => editor?.chain().focus().toggleCode().run(),
      active: () => editor?.isActive("code") ?? false,
    },
    null,
    {
      label: "⟲",
      title: "Undo (Ctrl+Z)",
      action: () => editor?.chain().focus().undo().run(),
      active: () => false,
    },
    {
      label: "⟳",
      title: "Redo (Ctrl+Y)",
      action: () => editor?.chain().focus().redo().run(),
      active: () => false,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/knowledge")}
          className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          ← Knowledge Base
        </button>
        <span className={`text-xs transition-colors ${saving ? "text-primary" : isDirty ? "text-amber-500" : "text-stone-400"}`}>
          {statusText}
        </span>
      </div>

      {/* Document title */}
      <input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        className="w-full text-4xl font-bold text-stone-900 border-none outline-none bg-transparent mb-6 placeholder-stone-300"
        placeholder="Untitled Document"
      />

      {/* Editor */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-200 px-3 py-2">
          {toolbarButtons.map((btn, i) =>
            btn === null ? (
              <div key={i} className="w-px h-5 bg-stone-200 mx-1" />
            ) : (
              <button
                key={btn.label}
                title={btn.title}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep editor focus
                  btn.action();
                }}
                className={`px-2 py-1 text-sm rounded font-mono transition-colors hover:bg-stone-100 ${
                  btn.active()
                    ? "bg-stone-200 text-stone-900"
                    : "text-stone-500 hover:text-stone-900"
                }`}
              >
                {btn.label}
              </button>
            ),
          )}
        </div>

        {/* Content */}
        <EditorContent editor={editor} />
      </div>

      <p className="mt-3 text-xs text-stone-400 text-right">
        Auto-saves as you type · Cmd+S to save now
      </p>
    </div>
  );
};

export default DocumentDetailPage;
