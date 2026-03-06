import { CheckIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { CellEditorProps, SelectOption } from "@/field-types/types";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getColorClasses, getColorByHash } from "@/field-types/colors";
import { cn } from "@/lib/utils";

export function MultiSelectCellEditor({
  value,
  config,
  onSave,
}: Omit<CellEditorProps, "onCancel">) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const options: SelectOption[] = config.options ?? [];

  const selected: string[] = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const [draft, setDraft] = useState<string[]>(selected);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const toggleOption = (optionId: string) => {
    setDraft((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId);
      }
      return [...prev, optionId];
    });
  };

  const handleDone = () => {
    onSave(draft.length === 0 ? null : draft);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setOpen(true);
      }}
    >
      <PopoverAnchor className="h-full w-full" />
      <PopoverContent
        align="start"
        side="bottom"
        className="w-56 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder="Search options..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-4 text-center text-[13px] text-muted-foreground">
              No options found.
            </div>
          ) : (
            filteredOptions.map((option) => {
              const optionId = option.id ?? option.label;
              const isSelected = draft.includes(optionId);
              const colorName =
                option.color ?? getColorByHash(option.label).name;
              const colors = getColorClasses(colorName);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleOption(optionId)}
                  className="hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]"
                >
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      colors.bg,
                      colors.text,
                      colors.border,
                    )}
                  >
                    {option.label}
                  </span>
                  {isSelected && (
                    <CheckIcon className="text-primary ml-auto h-4 w-4" />
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t p-2 flex justify-end">
          <Button size="sm" className="h-7 text-xs" onClick={handleDone}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
