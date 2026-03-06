import { CheckIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { CellEditorProps, StatusOption } from "@/field-types/types";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { getStatusDotClass } from "@/field-types/colors";
import { cn } from "@/lib/utils";
export function StatusCellEditor({
  value,
  config,
  onSave,
  onCancel,
}: CellEditorProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const didCommitRef = useRef(false);
  const options: StatusOption[] = config.options ?? [];
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleSelect = (optionValue: string) => {
    didCommitRef.current = true;
    if (optionValue === value) {
      onSave(null);
    } else {
      onSave(optionValue);
    }
    setOpen(false);
  };

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
            placeholder="Search statuses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-4 text-center text-[13px] text-muted-foreground">
              No statuses found.
            </div>
          ) : (
            filteredOptions.map((option) => {
              const dotColor = getStatusDotClass(option.label, option.color);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id ?? option.label)}
                  className="hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)}
                    />
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
