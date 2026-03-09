import { CheckIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
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

export function SelectCellEditor({
  value,
  config,
  onSave,
  onCancel,
}: CellEditorProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState(value != null ? String(value) : "");
  const didCommitRef = useRef(false);
  const options: SelectOption[] = config.options ?? [];
  const hasOptions = options.length > 0;

  const filteredOptions = hasOptions
    ? options.filter((option) =>
        option.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : [];

  const handleSelect = (optionValue: string) => {
    didCommitRef.current = true;
    if (optionValue === value) {
      onSave(null);
    } else {
      onSave(optionValue);
    }
    setOpen(false);
  };

  const handleFreeTextSave = () => {
    didCommitRef.current = true;
    const trimmed = query.trim();
    onSave(trimmed || null);
    setOpen(false);
  };

  if (!hasOptions) {
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
          className="w-56 p-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setOpen(false);
            onCancel();
          }}
        >
          <Input
            autoFocus
            placeholder="Enter value..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleFreeTextSave();
              }
            }}
            className="h-8 text-sm"
          />
          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCancel();
              }}
              className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs"
            >
              Cancel
            </button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleFreeTextSave}
            >
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o && !didCommitRef.current) onCancel();
        if (!o) didCommitRef.current = false;
        setOpen(o);
      }}
    >
      <PopoverAnchor className="h-full w-full" />
      <PopoverContent
        align="start"
        side="bottom"
        className="w-56 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
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
              const colorName =
                option.color ?? getColorByHash(option.label).name;
              const colors = getColorClasses(colorName);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id ?? option.label)}
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
                  {(value === option.id || value === option.label) && (
                    <CheckIcon className="text-primary ml-auto h-4 w-4" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
