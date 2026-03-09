import { BuildingIcon, CheckIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FormInputProps } from "@/field-types/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import { getList, getOne } from "@/lib/api/crm";
import { mapRecords, snakeToCamel } from "@/lib/crm/field-mapper";
import { cn } from "@/lib/utils";

interface CompanyOption {
  id: number;
  name: string;
}

export function CompanyFormInput({ value, onChange, error }: FormInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["companies", "list", search],
    queryFn: async () => {
      const result = await getList<Record<string, unknown>>("companies", {
        filter: search.trim() ? { q: search.trim() } : {},
        pagination: { page: 1, perPage: 50 },
      });
      const rows = mapRecords(result.data) as CompanyOption[];
      return { data: rows, total: result.total };
    },
    enabled: open,
    staleTime: 30_000,
  });

  const companyId = value != null ? Number(value) : null;
  const { data: selectedCompany } = useQuery({
    queryKey: ["companies", companyId],
    queryFn: async () => {
      const row = await getOne<Record<string, unknown>>(
        "companies",
        companyId!,
      );
      return snakeToCamel(row) as CompanyOption;
    },
    enabled: companyId != null && companyId > 0,
    staleTime: 60_000,
  });

  const companies = useMemo(() => data?.data ?? [], [data?.data]);
  const selectedInList = useMemo(
    () =>
      value != null ? companies.find((c) => c.id === Number(value)) : null,
    [companies, value],
  );

  const displayLabel =
    selectedInList?.name ??
    selectedCompany?.name ??
    (value != null ? String(value) : null);

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "border-input bg-background flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-1 text-sm shadow-xs",
              error && "border-destructive",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {displayLabel ? (
                <>
                  <BuildingIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{displayLabel}</span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  Search companies...
                </span>
              )}
            </span>
            <CaretDownIcon className="text-muted-foreground size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name, category..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isPending ? "Loading..." : "No companies found."}
              </CommandEmpty>
              <CommandItem
                value="__clear__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <span className="text-muted-foreground">No company</span>
              </CommandItem>
              {companies.map((company) => {
                const isSelected = value === company.id;
                return (
                  <CommandItem
                    key={company.id}
                    value={`${company.id}-${company.name}`}
                    onSelect={() => {
                      onChange(company.id);
                      setOpen(false);
                    }}
                  >
                    <BuildingIcon className="text-muted-foreground mr-2 size-4 shrink-0" />
                    <span className="flex-1 truncate">{company.name}</span>
                    {isSelected && (
                      <CheckIcon className="text-primary ml-auto size-4 shrink-0" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
