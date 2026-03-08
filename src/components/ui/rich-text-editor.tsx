import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { useEffect, useCallback, useState, useRef, useLayoutEffect } from "react";
import {
  TextHOne,
  TextHTwo,
  TextHThree,
  Paragraph,
  ListBullets,
  ListNumbers,
  Quotes,
  Code,
  Minus,
  TextB,
  TextItalic,
  TextStrikethrough,
  CheckSquare,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { registerRichTextDictationTarget } from "@/lib/dictation-target";

// ---------------------------------------------------------------------------
// Slash items — Novel pattern: each command receives { editor, range }
// and does deleteRange + block change in ONE atomic chain.
// ---------------------------------------------------------------------------

interface SlashCommandItem {
  label: string;
  description: string;
  searchTerms?: string[];
  icon: React.ComponentType<{ className?: string; weight?: string }>;
  command: (opts: { editor: Editor; range: { from: number; to: number } }) => void;
}

const SLASH_ITEMS: SlashCommandItem[] = [
  {
    label: "Text",
    description: "Just start typing with plain text.",
    searchTerms: ["p", "paragraph"],
    icon: Paragraph,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleNode("paragraph", "paragraph").run(),
  },
  {
    label: "Heading 1",
    description: "Big section heading.",
    searchTerms: ["title", "big", "large", "h1"],
    icon: TextHOne,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    label: "Heading 2",
    description: "Medium section heading.",
    searchTerms: ["subtitle", "medium", "h2"],
    icon: TextHTwo,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    label: "Heading 3",
    description: "Small section heading.",
    searchTerms: ["subtitle", "small", "h3"],
    icon: TextHThree,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    label: "To-do list",
    description: "Track tasks with checkboxes.",
    searchTerms: ["todo", "task", "check", "checkbox"],
    icon: CheckSquare,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    label: "Bullet list",
    description: "Create a simple bullet list.",
    searchTerms: ["unordered", "point", "ul"],
    icon: ListBullets,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    description: "Create a list with numbering.",
    searchTerms: ["ordered", "ol"],
    icon: ListNumbers,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    label: "Quote",
    description: "Capture a quote.",
    searchTerms: ["blockquote"],
    icon: Quotes,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleNode("paragraph", "paragraph").toggleBlockquote().run(),
  },
  {
    label: "Code",
    description: "Capture a code snippet.",
    searchTerms: ["codeblock"],
    icon: Code,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    label: "Divider",
    description: "Visual separator between sections.",
    searchTerms: ["hr", "separator", "line"],
    icon: Minus,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

// ---------------------------------------------------------------------------
// Slash menu component
// ---------------------------------------------------------------------------

function SlashMenu({
  items,
  onSelect,
  query,
}: {
  items: SlashCommandItem[];
  onSelect: (item: SlashCommandItem) => void;
  query: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.searchTerms?.some((t) => t.includes(q))
    );
  });

  useLayoutEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useLayoutEffect(() => {
    const active = menuRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-0 z-50 mt-1 max-h-[330px] w-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
    >
      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Blocks
      </div>
      {filtered.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            data-active={i === selectedIndex}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              i === selectedIndex ? "bg-accent" : "hover:bg-accent/50",
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background">
              <Icon className="size-[18px] text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">
                {item.description}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubble menu helpers
// ---------------------------------------------------------------------------

function BubbleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "flex size-8 items-center justify-center rounded transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function BubbleSeparator() {
  return <div className="mx-0.5 h-4 w-px bg-border" />;
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  content?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function RichTextEditor({
  content = "",
  onChange,
  placeholder = "Type '/' for commands\u2026",
  editable = true,
  autoFocus = false,
  className,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [slashState, setSlashState] = useState<{
    open: boolean;
    query: string;
    from: number;
    to: number;
  }>({ open: false, query: "", from: 0, to: 0 });

  const isInternalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {
          HTMLAttributes: { class: "list-disc list-outside leading-3" },
        },
        orderedList: {
          HTMLAttributes: { class: "list-decimal list-outside leading-3" },
        },
        listItem: {
          HTMLAttributes: { class: "leading-normal" },
        },
        blockquote: {
          HTMLAttributes: { class: "border-l-4 border-primary" },
        },
        codeBlock: {
          HTMLAttributes: {
            class: "rounded-md bg-muted text-muted-foreground border p-5 font-mono font-medium",
          },
        },
        code: {
          HTMLAttributes: {
            class: "rounded-md bg-muted px-1.5 py-1 font-mono font-medium",
            spellcheck: "false",
          },
        },
      }),
      TaskList.configure({
        HTMLAttributes: { class: "not-prose pl-2" },
      }),
      TaskItem.configure({
        HTMLAttributes: { class: "flex gap-2 items-start my-4" },
        nested: true,
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        transformPastedText: false,
        transformCopiedText: false,
      }),
    ],
    content,
    editable,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class:
          "prose prose-lg dark:prose-invert max-w-full focus:outline-none prose-headings:font-semibold prose-p:my-3 prose-li:my-1 prose-headings:mt-6 prose-headings:mb-3",
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Track slash command state
      const { state } = ed;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(
        Math.max(0, from - 50),
        from,
        "\ufffc",
      );

      const slashMatch = textBefore.match(/\/([a-zA-Z]*)$/);
      if (slashMatch) {
        const queryLen = slashMatch[1].length;
        setSlashState({
          open: true,
          query: slashMatch[1],
          from: from - queryLen - 1, // position of "/"
          to: from,                   // current cursor
        });
      } else {
        setSlashState((prev) => (prev.open ? { open: false, query: "", from: 0, to: 0 } : prev));
      }

      // Notify parent
      if (onChange) {
        isInternalChange.current = true;
        const md = ed.storage.markdown.getMarkdown();
        onChange(md);
      }
    },
  });

  // Sync external content changes (e.g., dialog open with existing note)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editor && content !== undefined) {
      const currentMd = editor.storage.markdown?.getMarkdown() ?? "";
      if (currentMd !== content) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    const editorElement = containerRef.current?.querySelector(
      ".tiptap",
    ) as HTMLElement | null;
    if (!editorElement) return;

    return registerRichTextDictationTarget(editorElement, editor);
  }, [editor]);

  // Handle slash command selection — single atomic chain (Novel pattern)
  const handleSlashSelect = useCallback(
    (item: SlashCommandItem) => {
      if (!editor) return;
      const range = { from: slashState.from, to: slashState.to };
      item.command({ editor, range });
      setSlashState({ open: false, query: "", from: 0, to: 0 });
    },
    [editor, slashState.from, slashState.to],
  );

  // Close slash menu on Escape
  useEffect(() => {
    if (!slashState.open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashState({ open: false, query: "", from: 0, to: 0 });
      }
    };
    document.addEventListener("keydown", handleEsc, true);
    return () => document.removeEventListener("keydown", handleEsc, true);
  }, [slashState.open]);

  if (!editor) return null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {editable && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 150 }}
          className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-md"
        >
          <BubbleButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <TextB className="size-4" weight="bold" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <TextItalic className="size-4" weight="bold" />
          </BubbleButton>
          <BubbleButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <TextStrikethrough className="size-4" weight="bold" />
          </BubbleButton>
          <BubbleSeparator />
          <BubbleButton
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="size-4" weight="bold" />
          </BubbleButton>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      {slashState.open && editable && (
        <SlashMenu
          items={SLASH_ITEMS}
          query={slashState.query}
          onSelect={handleSlashSelect}
        />
      )}
    </div>
  );
}
