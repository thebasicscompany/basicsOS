"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCursor } from "@tiptap/extension-collaboration-cursor";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

// Next.js page — requires default export
const DocumentDetailPage = (): JSX.Element => {
  const params = useParams();
  const router = useRouter();
  const id = params["id"] as string;

  const utils = trpc.useUtils();
  const { data: doc, error, isLoading } = trpc.knowledge.get.useQuery({ id });

  const updateMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      void utils.knowledge.get.invalidate({ id });
      void utils.knowledge.list.invalidate();
    },
  });

  const [localTitle, setLocalTitle] = useState("");
  const [collaborating, setCollaborating] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), []);

  const provider = useMemo(() => {
    const wsUrl = process.env["NEXT_PUBLIC_COLLAB_URL"] ?? "ws://localhost:4001";
    return new HocuspocusProvider({
      url: wsUrl,
      name: `doc-${id}`,
      document: ydoc,
      onConnect: () => setCollaborating(true),
      onDisconnect: () => setCollaborating(false),
    });
  }, [id, ydoc]);

  // Cleanup provider on unmount
  useEffect(() => {
    return () => {
      provider.destroy();
    };
  }, [provider]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }), // Collaboration extension handles undo/redo via Yjs
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: "You", color: "#6366f1" },
      }),
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-gray max-w-none min-h-[400px] focus:outline-none p-4",
      },
    },
  });

  // Populate editor title once doc loads (content is managed by Yjs)
  useEffect(() => {
    if (!doc) return;
    setLocalTitle(doc.title);
    if (editor && !editor.isDestroyed && doc.contentJson) {
      editor.commands.setContent(
        doc.contentJson as Parameters<typeof editor.commands.setContent>[0],
      );
    }
  // Run once when doc id and editor are both available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, editor]);

  const save = useCallback((): void => {
    if (!editor || !doc) return;
    updateMutation.mutate({
      id,
      title: localTitle,
      contentJson: editor.getJSON() as Record<string, unknown>,
    });
  }, [editor, doc, id, localTitle, updateMutation]);

  // Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [save]);

  if (error) {
    return <div className="p-8 text-center text-red-500">{error.message}</div>;
  }

  if (isLoading || !doc) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  }

  const saving = updateMutation.isPending;
  const saved = updateMutation.isSuccess;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/knowledge")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Knowledge Base
        </button>
        <div className="flex items-center gap-3">
          {collaborating && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
          <span className="text-xs text-gray-400">
            {saving ? "Saving..." : saved ? "Saved" : "Cmd+S to save"}
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Document title */}
      <input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={save}
        className="w-full text-4xl font-bold text-gray-900 border-none outline-none bg-transparent mb-4 placeholder-gray-300"
        placeholder="Untitled Document"
      />

      {/* TipTap editor */}
      <div className="rounded-xl border bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex gap-1 border-b px-3 py-2">
          {[
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
              label: "H1",
              title: "Heading 1",
              action: () =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run(),
              active: () =>
                editor?.isActive("heading", { level: 1 }) ?? false,
            },
            {
              label: "H2",
              title: "Heading 2",
              action: () =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run(),
              active: () =>
                editor?.isActive("heading", { level: 2 }) ?? false,
            },
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
            {
              label: "</>",
              title: "Code block",
              action: () => editor?.chain().focus().toggleCodeBlock().run(),
              active: () => editor?.isActive("codeBlock") ?? false,
            },
          ].map((btn) => (
            <button
              key={btn.label}
              title={btn.title}
              onClick={btn.action}
              className={`px-2 py-1 text-sm rounded font-mono hover:bg-gray-100 ${
                btn.active() ? "bg-gray-200 font-bold" : ""
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
        {/* Editor content */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default DocumentDetailPage;
