import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NameSaveValue {
  singleValue?: string;
  firstName?: string;
  lastName?: string;
}

interface EditableRecordNameProps {
  variant: "heading" | "field";
  label?: string;
  displayName: string;
  mode: "single" | "split" | "none";
  singleValue: string;
  firstName: string;
  lastName: string;
  onSave: (value: NameSaveValue) => void;
}

export function EditableRecordName({
  variant,
  label = "Name",
  displayName,
  mode,
  singleValue,
  firstName,
  lastName,
  onSave,
}: EditableRecordNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftSingleValue, setDraftSingleValue] = useState(singleValue);
  const [draftFirstName, setDraftFirstName] = useState(firstName);
  const [draftLastName, setDraftLastName] = useState(lastName);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) return;
    setDraftSingleValue(singleValue);
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
  }, [singleValue, firstName, lastName, isEditing]);

  const commitAndClose = useCallback(() => {
    if (mode === "split") {
      const trimmedFirst = draftFirstName.trim();
      const trimmedLast = draftLastName.trim();
      if (
        trimmedFirst !== firstName.trim() ||
        trimmedLast !== lastName.trim()
      ) {
        onSave({ firstName: trimmedFirst, lastName: trimmedLast });
      }
    } else if (mode === "single") {
      const trimmed = draftSingleValue.trim();
      if (trimmed !== singleValue.trim()) {
        onSave({ singleValue: trimmed });
      }
    }
    setIsEditing(false);
  }, [
    mode,
    draftFirstName,
    draftLastName,
    draftSingleValue,
    firstName,
    lastName,
    singleValue,
    onSave,
  ]);

  const startEditing = () => {
    if (mode === "none") return;
    setDraftSingleValue(singleValue);
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
    setIsEditing(true);
  };

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // If focus is moving to another element within the same container, don't close
      if (
        containerRef.current &&
        e.relatedTarget instanceof Node &&
        containerRef.current.contains(e.relatedTarget)
      ) {
        return;
      }
      commitAndClose();
    },
    [commitAndClose],
  );

  useEffect(() => {
    if (!isEditing) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        commitAndClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, commitAndClose]);

  const editor = (
    <div
      ref={containerRef}
      className={cn(
        "min-w-0",
        variant === "heading"
          ? "flex items-center gap-2"
          : "flex w-full flex-col gap-2",
      )}
    >
      {mode === "split" ? (
        <div
          className={cn(
            "min-w-0 gap-2",
            variant === "heading"
              ? "grid flex-1 grid-cols-2"
              : "grid grid-cols-2",
          )}
        >
          <Input
            autoFocus
            value={draftFirstName}
            placeholder="First name"
            onChange={(event) => setDraftFirstName(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitAndClose();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setDraftFirstName(firstName);
                setDraftLastName(lastName);
                setIsEditing(false);
              }
            }}
          />
          <Input
            value={draftLastName}
            placeholder="Last name"
            onChange={(event) => setDraftLastName(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitAndClose();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setDraftFirstName(firstName);
                setDraftLastName(lastName);
                setIsEditing(false);
              }
            }}
          />
        </div>
      ) : (
        <Input
          autoFocus
          value={draftSingleValue}
          placeholder={label}
          onChange={(event) => setDraftSingleValue(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAndClose();
            }
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraftSingleValue(singleValue);
              setIsEditing(false);
            }
          }}
          className={variant === "heading" ? "min-w-[240px]" : undefined}
        />
      )}
    </div>
  );

  if (variant === "heading") {
    return isEditing ? (
      <div className="min-w-0 flex-1">{editor}</div>
    ) : (
      <button
        type="button"
        onDoubleClick={startEditing}
        className="min-w-0 truncate rounded px-1 -mx-1 text-left text-xl font-semibold tracking-tight"
        title="Double-click to edit name"
      >
        {displayName}
      </button>
    );
  }

  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 items-start py-1.5 overflow-hidden">
      <div className="flex min-h-[28px] items-center gap-1.5 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
      </div>
      <div className="min-h-[28px] min-w-0 flex items-start overflow-hidden">
        {isEditing ? (
          <div className="w-full min-w-0">{editor}</div>
        ) : (
          <button
            type="button"
            onDoubleClick={startEditing}
            className="w-full min-w-0 rounded px-1 -mx-1 py-0.5 text-left transition-colors hover:bg-muted"
            title="Double-click to edit name"
          >
            <span className="block break-words text-sm font-medium">
              {displayName}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
