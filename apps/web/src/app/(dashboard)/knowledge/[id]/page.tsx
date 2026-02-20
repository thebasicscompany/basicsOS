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
import { Button, Input, PageHeader, Bold, Italic, Heading1, Heading2, List, ListOrdered, Code2 } from "@basicsos/ui";

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
        class: "prose prose-stone max-w-none min-h-[400px] focus:outline-none p-4",
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
    return <div className="p-8 text-center text-destructive">{error.message}</div>;
  }

  if (isLoading || !doc) {
    return <div className="p-8 text-center text-stone-500">Loading...</div>;
  }

  const saving = updateMutation.isPending;
  const saved = updateMutation.isSuccess;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Title bar */}
      <PageHeader
        title=""
        backHref="/knowledge"
        backLabel="Knowledge Base"
        className="mb-6"
        action={
          <div className="flex items-center gap-3">
            {collaborating && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs text-stone-500">
              {saving ? "Saving..." : saved ? "Saved" : "Cmd+S to save"}
            </span>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      {/* Document title */}
      <Input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={save}
        className="w-full text-4xl font-bold text-stone-900 border-none bg-transparent mb-4 placeholder-stone-300 shadow-none h-auto p-0"
        placeholder="Untitled Document"
      />

      {/* TipTap editor */}
      <div className="rounded-lg bg-white shadow-card">
        {/* Toolbar */}
        <div className="flex gap-0.5 border-b border-stone-100 px-2 py-1.5">
          {[
            {
              Icon: Bold,
              title: "Bold",
              action: () => editor?.chain().focus().toggleBold().run(),
              active: () => editor?.isActive("bold") ?? false,
            },
            {
              Icon: Italic,
              title: "Italic",
              action: () => editor?.chain().focus().toggleItalic().run(),
              active: () => editor?.isActive("italic") ?? false,
            },
            {
              Icon: Heading1,
              title: "Heading 1",
              action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
              active: () => editor?.isActive("heading", { level: 1 }) ?? false,
            },
            {
              Icon: Heading2,
              title: "Heading 2",
              action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
              active: () => editor?.isActive("heading", { level: 2 }) ?? false,
            },
            {
              Icon: List,
              title: "Bullet list",
              action: () => editor?.chain().focus().toggleBulletList().run(),
              active: () => editor?.isActive("bulletList") ?? false,
            },
            {
              Icon: ListOrdered,
              title: "Ordered list",
              action: () => editor?.chain().focus().toggleOrderedList().run(),
              active: () => editor?.isActive("orderedList") ?? false,
            },
            {
              Icon: Code2,
              title: "Code block",
              action: () => editor?.chain().focus().toggleCodeBlock().run(),
              active: () => editor?.isActive("codeBlock") ?? false,
            },
          ].map((btn) => (
            <Button
              key={btn.title}
              variant="ghost"
              size="icon"
              title={btn.title}
              onClick={btn.action}
              className={btn.active() ? "bg-stone-200" : ""}
            >
              <btn.Icon size={16} />
            </Button>
          ))}
        </div>
        {/* Editor content */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default DocumentDetailPage;
