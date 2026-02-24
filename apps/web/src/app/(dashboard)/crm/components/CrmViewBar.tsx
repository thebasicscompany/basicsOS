"use client";

import { useState, useRef, useEffect } from "react";
import {
  Input,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Switch,
  Label,
  addToast,
  cn,
} from "@basicsos/ui";
import { Search, ChevronDown, List, Square, Columns3, Bookmark, BookmarkPlus, Trash2 } from "@basicsos/ui";
import { CrmFilterChip } from "./CrmFilterChip";
import { CrmSortChip } from "./CrmSortChip";
import type { CrmFilter, CrmViewState } from "../hooks/useCrmViewState";
import { trpc } from "@/lib/trpc";

interface FilterDef {
  field: string;
  label: string;
  type: "text" | "select";
  options?: Array<{ label: string; value: string }>;
}

interface SavedViewPayload {
  filters: unknown;
  sort: unknown;
  columnVisibility: unknown;
}

interface CrmViewBarProps {
  viewState: CrmViewState;
  filterDefs?: FilterDef[];
  sortFields?: Array<{ field: string; label: string }>;
  columnDefs?: Array<{ key: string; label: string }>;
  showViewToggle?: boolean;
  action?: React.ReactNode;
  entity?: "contacts" | "companies" | "deals";
  onApplyView?: (view: SavedViewPayload) => void;
}

export function CrmViewBar({
  viewState,
  filterDefs = [],
  sortFields = [],
  columnDefs = [],
  showViewToggle = false,
  action,
  entity,
  onApplyView,
}: CrmViewBarProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SearchInput value={viewState.search} onChange={viewState.setSearch} />
        {filterDefs.length > 0 && (
          <FilterDropdown defs={filterDefs} onAdd={viewState.addFilter} />
        )}
        {sortFields.length > 0 && (
          <SortDropdown fields={sortFields} onSort={viewState.setSort} />
        )}
        {columnDefs.length > 0 && (
          <FieldsDropdown
            columns={columnDefs}
            hiddenColumns={viewState.hiddenColumns}
            onToggle={viewState.toggleColumn}
          />
        )}
        {entity !== undefined && (
          <>
            <SavedViewsDropdown entity={entity} {...(onApplyView ? { onApplyView } : {})} />
            <SaveViewDialog entity={entity} viewState={viewState} columnDefs={columnDefs} />
          </>
        )}
        <div className="flex-1" />
        {showViewToggle && (
          <ViewToggle viewType={viewState.viewType} onChange={viewState.setViewType} />
        )}
        {action}
      </div>
      <ActiveChips viewState={viewState} />
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative w-64">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder="Search... ( / )"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 h-8 text-sm"
      />
    </div>
  );
}

function FilterDropdown({
  defs,
  onAdd,
}: {
  defs: FilterDef[];
  onAdd: (filter: CrmFilter) => void;
}): JSX.Element {
  const [selectedField, setSelectedField] = useState<FilterDef | null>(null);
  const [filterValue, setFilterValue] = useState("");

  const handleAddFilter = (): void => {
    if (!selectedField || !filterValue.trim()) return;
    onAdd({
      field: selectedField.field,
      operator: selectedField.type === "select" ? "is" : "contains",
      value: filterValue.trim(),
    });
    setSelectedField(null);
    setFilterValue("");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
          Filter <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-2">
        {!selectedField ? (
          defs.map((def) => (
            <DropdownMenuItem key={def.field} onSelect={() => setSelectedField(def)}>
              {def.label}
            </DropdownMenuItem>
          ))
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground capitalize">{selectedField.label}</p>
            {selectedField.type === "select" && selectedField.options ? (
              <div className="flex flex-col gap-1">
                {selectedField.options.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => {
                      onAdd({ field: selectedField.field, operator: "is", value: opt.value });
                      setSelectedField(null);
                    }}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <div className="flex gap-1">
                <Input
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddFilter(); }}
                  placeholder="Value..."
                  className="h-7 text-xs"
                  autoFocus
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleAddFilter}>
                  Add
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedField(null)}>
              Back
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortDropdown({
  fields,
  onSort,
}: {
  fields: Array<{ field: string; label: string }>;
  onSort: (field: string) => void;
}): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
          Sort <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {fields.map((f) => (
          <DropdownMenuItem key={f.field} onSelect={() => onSort(f.field)}>
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewToggle({
  viewType,
  onChange,
}: {
  viewType: "table" | "kanban";
  onChange: (v: "table" | "kanban") => void;
}): JSX.Element {
  return (
    <div className="flex items-center rounded-md border border-stone-200 dark:border-stone-700">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "flex items-center justify-center size-8 rounded-l-md transition-colors",
          viewType === "table" ? "bg-stone-100 dark:bg-stone-700 text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Table view"
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("kanban")}
        className={cn(
          "flex items-center justify-center size-8 rounded-r-md transition-colors",
          viewType === "kanban" ? "bg-stone-100 dark:bg-stone-700 text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Kanban view"
      >
        <Square className="size-4" />
      </button>
    </div>
  );
}

function FieldsDropdown({
  columns,
  hiddenColumns,
  onToggle,
}: {
  columns: Array<{ key: string; label: string }>;
  hiddenColumns: Set<string>;
  onToggle: (key: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" id="crm-columns-btn">
          <Columns3 className="size-3" /> Columns <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Add / remove columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={!hiddenColumns.has(col.key)}
            onCheckedChange={() => onToggle(col.key)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SavedViewsDropdown({
  entity,
  onApplyView,
}: {
  entity: "contacts" | "companies" | "deals";
  onApplyView?: (view: SavedViewPayload) => void;
}): JSX.Element {
  const utils = trpc.useUtils();
  const { data: views = [] } = trpc.crm.savedViews.list.useQuery({ entity });

  const deleteView = trpc.crm.savedViews.delete.useMutation({
    onSuccess: () => {
      void utils.crm.savedViews.list.invalidate({ entity });
      addToast({ title: "View deleted", variant: "success" });
    },
    onError: (err) => addToast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
          <Bookmark className="size-3" /> Views <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No saved views yet
          </div>
        ) : (
          views.map((view) => (
            <div key={view.id} className="flex items-center gap-1 px-1">
              <DropdownMenuItem
                className="flex-1 text-xs"
                onSelect={() => {
                  if (!onApplyView) return;
                  onApplyView({
                    filters: view.filters,
                    sort: view.sort,
                    columnVisibility: view.columnVisibility,
                  });
                  addToast({ title: `Applied "${view.name}"`, variant: "success" });
                }}
              >
                <span className="flex-1 truncate">{view.name}</span>
                {view.isDefault && (
                  <span className="ml-1 rounded bg-stone-100 dark:bg-stone-700 px-1 py-0.5 text-[10px] text-muted-foreground">
                    default
                  </span>
                )}
              </DropdownMenuItem>
              <button
                type="button"
                className="flex items-center justify-center size-6 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteView.mutate({ id: view.id });
                }}
                aria-label={`Delete "${view.name}"`}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SaveViewDialog({
  entity,
  viewState,
  columnDefs,
}: {
  entity: "contacts" | "companies" | "deals";
  viewState: CrmViewState;
  columnDefs: Array<{ key: string; label: string }>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const utils = trpc.useUtils();

  const createView = trpc.crm.savedViews.create.useMutation({
    onSuccess: () => {
      void utils.crm.savedViews.list.invalidate({ entity });
      addToast({ title: "View saved!", variant: "success" });
      setOpen(false);
      setName("");
      setIsDefault(false);
    },
    onError: (err) => addToast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const handleSave = (): void => {
    if (!name.trim()) return;

    // Build filters payload from viewState
    const filtersPayload: Record<string, unknown> = {};
    viewState.filters.forEach((f) => {
      filtersPayload[f.field] = { operator: f.operator, value: f.value };
    });

    // Build sort payload
    const sortPayload: Record<string, unknown> = viewState.sort
      ? { field: viewState.sort, dir: viewState.sortDir }
      : {};

    // Build column visibility payload
    const columnVisibilityPayload: Record<string, unknown> = {};
    columnDefs.forEach((col) => {
      columnVisibilityPayload[col.key] = !viewState.hiddenColumns.has(col.key);
    });

    createView.mutate({
      entity,
      name: name.trim(),
      filters: filtersPayload,
      sort: sortPayload,
      columnVisibility: columnVisibilityPayload,
      isDefault,
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1"
        onClick={() => setOpen(true)}
      >
        <BookmarkPlus className="size-3" /> Save View
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-name" className="text-xs">View name</Label>
              <Input
                id="view-name"
                placeholder="e.g. Won deals this quarter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                className="h-8 text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="set-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <Label htmlFor="set-default" className="text-xs cursor-pointer">
                Set as default view
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!name.trim() || createView.isPending}
            >
              {createView.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActiveChips({ viewState }: { viewState: CrmViewState }): JSX.Element | null {
  const hasChips = viewState.filters.length > 0 || viewState.sort;
  if (!hasChips) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {viewState.sort && (
        <CrmSortChip
          field={viewState.sort}
          direction={viewState.sortDir}
          onToggle={viewState.toggleSortDir}
          onRemove={() => viewState.setSort("")}
        />
      )}
      {viewState.filters.map((f) => (
        <CrmFilterChip
          key={f.field}
          field={f.field}
          value={f.value}
          operator={f.operator}
          onRemove={() => viewState.removeFilter(f.field)}
        />
      ))}
      {viewState.filters.length > 1 && (
        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={viewState.clearFilters}>
          Clear all
        </Button>
      )}
    </div>
  );
}
