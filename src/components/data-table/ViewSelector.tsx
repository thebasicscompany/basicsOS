import {
  SquaresFourIcon,
  ListIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface ViewSelectorProps {
  views: Array<{ id: string; title: string; type: string }>;
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  onCreateView?: () => void;
  onRenameView?: (viewId: string, title: string) => void | Promise<void>;
  onDeleteView?: (viewId: string) => void | Promise<void>;
  defaultViewId?: string;
}

function getViewIcon(type: string) {
  switch (type) {
    case "grid":
      return SquaresFourIcon;
    case "kanban":
      return ListIcon;
    default:
      return SquaresFourIcon;
  }
}

export function ViewSelector({
  views,
  activeViewId,
  onSelectView,
  onCreateView,
  onRenameView,
  onDeleteView,
  defaultViewId = "",
}: ViewSelectorProps) {
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingViewId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingViewId]);

  const handleStartRename = (view: { id: string; title: string }) => {
    setEditingViewId(view.id);
    setEditValue(view.title);
  };

  const handleCommitRename = () => {
    if (!editingViewId || !onRenameView) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      onRenameView(editingViewId, trimmed);
    }
    setEditingViewId(null);
  };

  const handleCancelRename = () => {
    setEditingViewId(null);
  };

  return (
    <div className="flex items-center gap-0.5 border-b">
      {views.map((view) => {
        const Icon = getViewIcon(view.type);
        const isActive = view.id === activeViewId;
        const isDefault = view.id === defaultViewId;
        const isEditing = editingViewId === view.id;

        return (
          <div
            key={view.id}
            className={cn(
              "group/view flex items-center gap-1 border-b-2 transition-colors",
              isActive ? "border-primary" : "border-transparent",
            )}
          >
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleCommitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommitRename();
                  if (e.key === "Escape") handleCancelRename();
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-7 w-24 border-0 border-b-2 border-primary bg-transparent px-2 text-xs focus-visible:ring-0"
              />
            ) : (
              <button
                onClick={() => onSelectView(view.id)}
                onDoubleClick={() => onRenameView && handleStartRename(view)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{view.title}</span>
              </button>
            )}
            {!isDefault && onDeleteView && !isEditing && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteView(view.id);
                }}
                className="opacity-0 group-hover/view:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
                aria-label="Delete view"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>
        );
      })}

      {onCreateView && (
        <button
          type="button"
          aria-label="Create view"
          onClick={onCreateView}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground border-b-2 border-transparent transition-colors"
        >
          <PlusIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
