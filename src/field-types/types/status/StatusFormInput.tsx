import { CheckIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormInputProps, StatusOption } from "@/field-types/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { getStatusDotClass } from "@/field-types/colors";
import { cn } from "@/lib/utils";
export function StatusFormInput({
  value,
  config,
  onChange,
  error,
  attribute,
}: FormInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options: StatusOption[] = config.options ?? [];
  const selected = options.find((o) => o.id === value || o.label === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "border-input bg-background flex h-9 w-full items-center justify-between rounded-md border px-3 py-1 text-sm shadow-xs",
              error && "border-destructive",
            )}
          >
            {selected ? (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    getStatusDotClass(selected.label, selected.color),
                  )}
                />
                {selected.label}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Select {attribute.name.toLowerCase()}...
              </span>
            )}
            <CaretDownIcon className="text-muted-foreground h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
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
                    onClick={() => {
                      onChange(
                        option.id === value
                          ? null
                          : (option.id ?? option.label),
                      );
                      setOpen(false);
                    }}
                    className="hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]"
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          dotColor,
                        )}
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
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
