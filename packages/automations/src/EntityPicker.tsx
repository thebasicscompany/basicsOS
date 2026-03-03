import { useState, useEffect, useCallback, useRef } from "react";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "basics-os/src/components/ui/button";
import { Input } from "basics-os/src/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "basics-os/src/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "basics-os/src/components/ui/command";
import { cn } from "basics-os/src/lib/utils";
import { getList } from "basics-os/src/lib/api/crm";
import { VariablePicker } from "./VariablePicker";
import type { Variable } from "./useAvailableVariables";

export type EntityPickerResource = "contacts" | "deals";

function getDisplayLabel(
  resource: EntityPickerResource,
  item: Record<string, unknown>,
): string {
  if (resource === "contacts") {
    const first = (item.firstName ?? item.first_name) as string | null;
    const last = (item.lastName ?? item.last_name) as string | null;
    const email = (item.email) as string | null;
    const name = [first, last].filter(Boolean).join(" ").trim();
    return name || email || `#${item.id}`;
  }
  if (resource === "deals") {
    return (item.name as string) || `#${item.id}`;
  }
  return `#${item.id}`;
}

export interface EntityPickerInputProps {
  resource: EntityPickerResource;
  value: string;
  onChange: (value: string) => void;
  variables: Variable[];
  placeholder?: string;
  className?: string;
}

const API_RESOURCE: Record<EntityPickerResource, string> = {
  contacts: "contacts_summary",
  deals: "deals",
};

export function EntityPickerInput({
  resource,
  value,
  onChange,
  variables,
  placeholder,
  className,
}: EntityPickerInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchItems = useCallback(
    async (q: string) => {
      setIsLoading(true);
      try {
        const { data } = await getList<Record<string, unknown>>(
          API_RESOURCE[resource],
          {
            pagination: { page: 1, perPage: 20 },
            filter: q ? { q } : {},
            sort: resource === "contacts" ? { field: "first_name", order: "ASC" } : { field: "name", order: "ASC" },
          },
        );
        setItems(data);
      } catch {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [resource],
  );

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchItems(search);
      debounceRef.current = null;
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, search, fetchItems]);

  const handleSelect = useCallback(
    (item: Record<string, unknown>) => {
      const id = item.id != null ? String(item.id) : "";
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );


  const inputContainerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  const captureSelection = () => {
    const el = inputContainerRef.current?.querySelector("input") as HTMLInputElement | null;
    if (el) {
      selectionRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
    }
  };

  const handleInsertVariableAtCursor = (text: string) => {
    const el = inputContainerRef.current?.querySelector("input") as HTMLInputElement | null;
    if (!el) return;
    const { start, end } = selectionRef.current ?? { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div ref={inputContainerRef} className={cn("flex w-full min-w-0 items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border bg-background">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-r-md"
              title={`Search ${resource}`}
            >
              <CaretDownIcon className="size-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent align="start" className="w-72 p-0" side="bottom">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${resource}...`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : `No ${resource} found.`}
              </CommandEmpty>
              {items.map((item) => {
                const id = String(item.id);
                const label = getDisplayLabel(resource, item);
                const isSelected = value === id;
                return (
                  <CommandItem
                    key={id}
                    value={`${label} ${id}`}
                    onSelect={() => handleSelect(item)}
                  >
                    <span className="flex-1 truncate">{label}</span>
                    {isSelected && <CheckIcon className="size-4 shrink-0 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {variables.length > 0 && (
        <div onMouseDown={captureSelection}>
          <VariablePicker variables={variables} onInsert={handleInsertVariableAtCursor} />
        </div>
      )}
    </div>
  );
}
