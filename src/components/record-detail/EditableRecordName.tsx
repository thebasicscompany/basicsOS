import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (isEditing) return;
    setDraftSingleValue(singleValue);
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
  }, [singleValue, firstName, lastName, isEditing]);

  const startEditing = () => {
    if (mode === "none") return;
    setDraftSingleValue(singleValue);
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftSingleValue(singleValue);
    setDraftFirstName(firstName);
    setDraftLastName(lastName);
    setIsEditing(false);
  };

  const saveEditing = () => {
    if (mode === "split") {
      onSave({
        firstName: draftFirstName.trim(),
        lastName: draftLastName.trim(),
      });
    } else if (mode === "single") {
      onSave({ singleValue: draftSingleValue.trim() });
    }
    setIsEditing(false);
  };

  const editor = (
    <form
      className={cn(
        "min-w-0",
        variant === "heading" ? "flex items-center gap-2" : "flex w-full flex-col gap-2",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        saveEditing();
      }}
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
          />
          <Input
            value={draftLastName}
            placeholder="Last name"
            onChange={(event) => setDraftLastName(event.target.value)}
          />
        </div>
      ) : (
        <Input
          autoFocus
          value={draftSingleValue}
          placeholder={label}
          onChange={(event) => setDraftSingleValue(event.target.value)}
          className={variant === "heading" ? "min-w-[240px]" : undefined}
        />
      )}

      <div className="flex shrink-0 items-center gap-2">
        <Button type="submit" size="xs">
          Save
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={cancelEditing}>
          Cancel
        </Button>
      </div>
    </form>
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
