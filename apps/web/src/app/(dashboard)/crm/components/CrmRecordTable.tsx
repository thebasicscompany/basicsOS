"use client";

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import type { ComponentType, SVGProps } from "react";
import {
  EmptyState,
  Input,
  Badge,
  cn,
  ChevronUp,
  ChevronDown,
  Plus,
  Check,
  Search,
  Hash,
  Calendar,
  List,
  Phone,
  X,
} from "@basicsos/ui";
import { trpc } from "@/lib/trpc";
import { addToast } from "@basicsos/ui";
import { OPTION_COLORS, normalizeOptions, getOptionColor } from "../utils";
import type { SelectOption } from "../utils";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface ColumnDef<T> {
  key: string;
  label: string;
  icon?: React.ElementType;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  /** Returns the raw string value to seed the inline editor with. Falls back to sortValue. */
  editValue?: (row: T) => string;
  /** @deprecated Use defaultWidth (number in px) instead. Kept for backward compat. */
  width?: string;
  /** Default column width in pixels. Columns are resizable by dragging header borders. */
  defaultWidth?: number;
  /** Minimum column width in pixels during resize. Defaults to 80. */
  minWidth?: number;
  align?: "left" | "right";
  editable?: boolean;
  editType?: "text" | "select" | "multi_select" | "number" | "date" | "boolean" | "url" | "phone" | undefined;
  editOptions?: Array<{ label: string; value: string; color?: string }> | undefined;
  onEdit?: ((rowId: string, value: string) => void) | undefined;
}

/** Sensible default widths (px) for common column types/keys. */
const DEFAULT_COL_WIDTH = 150;
const COL_WIDTH_MAP: Record<string, number> = {
  name: 220,
  email: 200,
  phone: 150,
  company: 150,
  companyName: 150,
  createdAt: 120,
  created: 120,
  stage: 130,
  value: 120,
  status: 130,
  dealName: 200,
  contactName: 180,
};
const MIN_COL_WIDTH = 60;
const CHECKBOX_COL_WIDTH = 36;
const ADD_COL_WIDTH = 120;

const FIELD_TYPES = [
  { value: "text", label: "Text", icon: Search },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: Calendar },
  { value: "boolean", label: "Checkbox", icon: Check },
  { value: "select", label: "Select", icon: List },
  { value: "multi_select", label: "Multi-select", icon: List },
  { value: "url", label: "URL", icon: ChevronDown },
  { value: "phone", label: "Phone", icon: Phone },
] as const;

type FieldType = typeof FIELD_TYPES[number]["value"];

function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || "field";
}

interface AddColumnPopoverProps {
  allColumns: Array<{ key: string; label: string }>;
  hiddenColumns: Set<string>;
  onToggle: (key: string) => void;
  entity: "contacts" | "companies" | "deals";
  onFieldCreated: () => void;
}

function isSelectType(type: FieldType): boolean {
  return type === "select" || type === "multi_select";
}

function AddColumnPopover({
  allColumns,
  hiddenColumns,
  onToggle,
  entity,
  onFieldCreated,
}: AddColumnPopoverProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [step, setStep] = useState<"type" | "options">("type");
  const [newFieldOptions, setNewFieldOptions] = useState<SelectOption[]>([]);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const createField = trpc.crm.customFieldDefs.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Field created", variant: "success" });
      void utils.crm.customFieldDefs.list.invalidate({ entity });
      onFieldCreated();
      resetCreateState();
      setOpen(false);
    },
    onError: (err) => addToast({ title: "Failed to create field", description: err.message, variant: "destructive" }),
  });

  const resetCreateState = (): void => {
    setNewFieldName("");
    setNewFieldType("text");
    setStep("type");
    setNewFieldOptions([]);
    setCreating(false);
  };

  const handleCreate = (): void => {
    const label = newFieldName.trim();
    if (!label) return;
    createField.mutate({
      entity,
      key: labelToKey(label),
      label,
      type: newFieldType,
      options: isSelectType(newFieldType) && newFieldOptions.length > 0 ? newFieldOptions : undefined,
    });
  };

  const handleNext = (): void => {
    if (!newFieldName.trim()) return;
    if (isSelectType(newFieldType)) {
      setStep("options");
    } else {
      handleCreate();
    }
  };

  const addOption = (): void => {
    setNewFieldOptions((prev) => [
      ...prev,
      {
        label: "",
        value: "",
        color: OPTION_COLORS[prev.length % OPTION_COLORS.length]!.name,
      },
    ]);
  };

  const updateOption = (index: number, updates: Partial<SelectOption>): void => {
    setNewFieldOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== index) return opt;
        const updated = { ...opt, ...updates };
        if (updates.label !== undefined) {
          updated.value = updates.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        }
        return updated;
      }),
    );
  };

  const removeOption = (index: number): void => {
    setNewFieldOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const openPanel = (): void => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
    resetCreateState();
    setSearch("");
  };

  // Dismiss on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        resetCreateState();
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = allColumns.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

  let panel: React.ReactNode = null;

  if (open && panelPos) {
    if (!creating) {
      panel = (
        <div
          ref={panelRef}
          className="fixed z-[9999] w-56 rounded-lg border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900"
          style={{ top: panelPos.top, left: panelPos.left }}
        >
          {/* Search */}
          <div className="flex items-center gap-1.5 border-b border-stone-100 px-2 py-1.5 dark:border-stone-800">
            <Search className="size-3.5 shrink-0 text-stone-400" />
            <input
              autoFocus
              placeholder="Search attributes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-stone-400 dark:text-stone-100"
            />
          </div>

          {/* Column list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((col) => {
              const visible = !hiddenColumns.has(col.key);
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => onToggle(col.key)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  <span className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                    visible
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-stone-300 dark:border-stone-600",
                  )}>
                    {visible && <Check className="size-2.5" />}
                  </span>
                  <span className="flex-1 text-left">{col.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-stone-400">No attributes found</p>
            )}
          </div>

          {/* Divider + Create */}
          <div className="border-t border-stone-100 py-1 dark:border-stone-800">
            <button
              type="button"
              onClick={() => { setCreating(true); setSearch(""); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              <Plus className="size-3.5 shrink-0 text-stone-400" />
              <span>Create new field</span>
            </button>
          </div>
        </div>
      );
    } else if (step === "type") {
      panel = (
        <div
          ref={panelRef}
          className="fixed z-[9999] w-64 rounded-lg border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900"
          style={{ top: panelPos.top, left: panelPos.left }}
        >
          <div className="border-b border-stone-100 px-3 py-2 dark:border-stone-800">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-300">Create field</p>
          </div>
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Name</label>
              <Input
                autoFocus
                placeholder="Field name..."
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleNext(); if (e.key === "Escape") resetCreateState(); }}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-stone-500 dark:text-stone-400">Type</label>
              <div className="grid grid-cols-2 gap-1">
                {FIELD_TYPES.map((ft) => {
                  const Icon = ft.icon;
                  return (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setNewFieldType(ft.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                        newFieldType === ft.value
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800",
                      )}
                    >
                      <Icon className="size-3 shrink-0" />
                      {ft.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!newFieldName.trim() || createField.isPending}
              onClick={handleNext}
              className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
            >
              {isSelectType(newFieldType) ? "Next" : createField.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      );
    } else {
      // step === "options"
      panel = (
        <div
          ref={panelRef}
          className="fixed z-[9999] w-80 rounded-lg border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900"
          style={{ top: panelPos.top, left: panelPos.left }}
        >
          <div className="border-b border-stone-100 px-3 py-2 dark:border-stone-800">
            <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
              Add options for &ldquo;{newFieldName}&rdquo;
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {newFieldOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    autoFocus={idx === newFieldOptions.length - 1}
                    placeholder="Option label..."
                    value={opt.label}
                    onChange={(e) => updateOption(idx, { label: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                    className="h-7 flex-1 text-xs"
                  />
                  {/* Color picker dots */}
                  <div className="flex items-center gap-0.5">
                    {OPTION_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => updateOption(idx, { color: c.name })}
                        className={cn(
                          "size-4 rounded-full transition-all",
                          c.dot,
                          opt.color === c.name ? "ring-2 ring-stone-400 ring-offset-1 dark:ring-stone-500" : "opacity-60 hover:opacity-100",
                        )}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              className="mt-2 flex items-center gap-1 text-xs text-stone-500 transition-colors hover:text-stone-700 dark:hover:text-stone-300"
            >
              <Plus className="size-3" />
              Add option
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setStep("type")}
              className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Back
            </button>
            <button
              type="button"
              disabled={createField.isPending}
              onClick={handleCreate}
              className="rounded-md bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
            >
              {createField.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPanel}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
      >
        <Plus className="size-3" />
        Add column
      </button>
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}

interface CrmRecordTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  onRowClick?: ((row: T) => void) | undefined;
  onSelectionChange?: ((ids: string[]) => void) | undefined;
  hiddenColumns?: Set<string> | undefined;
  onToggleColumn?: ((key: string) => void) | undefined;
  sort?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  onSort?: ((field: string) => void) | undefined;
  contextMenuItems?: ((row: T) => Array<{ label: string; onClick: () => void; destructive?: boolean }>) | undefined;
  emptyIcon?: LucideIcon | undefined;
  emptyHeading?: string | undefined;
  emptyDescription?: string | undefined;
  emptyAction?: React.ReactNode | undefined;
  entity?: "contacts" | "companies" | "deals" | undefined;
  onFieldCreated?: (() => void) | undefined;
  externalSelectedIds?: string[];
}

interface SelectedCell {
  rowId: string;
  colKey: string;
  colIndex: number;
  rowIndex: number;
}

interface CellEditorRef {
  saveValue?: () => void;
  focus?: () => void;
}

export function CrmRecordTable<T>({
  data,
  columns: allColumns,
  getRowId,
  onRowClick,
  onSelectionChange,
  hiddenColumns,
  onToggleColumn,
  sort,
  sortDir,
  onSort,
  contextMenuItems,
  emptyIcon,
  emptyHeading = "No records found",
  emptyDescription = "Try adjusting your filters or create a new record.",
  emptyAction,
  entity,
  onFieldCreated,
  externalSelectedIds,
}: CrmRecordTableProps<T>): JSX.Element {
  const columns = hiddenColumns?.size
    ? allColumns.filter((col) => !hiddenColumns.has(col.key))
    : allColumns;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sync external selection state (e.g. when parent calls setSelectedIds([]))
  useEffect(() => {
    if (externalSelectedIds === undefined) return;
    setSelectedIds(new Set(externalSelectedIds));
  }, [externalSelectedIds]);

  // Stage 1: cell is selected (highlighted ring, no editor open)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  // Stage 2: cell is actively being edited (portal editor open)
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  // Initial key seeded into editor when opened via printable key
  const [editorInitialKey, setEditorInitialKey] = useState<string | undefined>(undefined);
  // Portal position (from getBoundingClientRect)
  const [portalRect, setPortalRect] = useState<DOMRect | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: T } | null>(null);

  // ── Column widths & resize state ──
  const getDefaultWidth = useCallback((col: ColumnDef<T>): number => {
    if (col.defaultWidth) return col.defaultWidth;
    if (col.width) return parseInt(col.width, 10) || DEFAULT_COL_WIDTH;
    return COL_WIDTH_MAP[col.key] ?? DEFAULT_COL_WIDTH;
  }, []);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const widths: Record<string, number> = {};
    for (const col of allColumns) {
      widths[col.key] = getDefaultWidth(col);
    }
    return widths;
  });

  // Keep widths in sync when columns change (e.g. new custom field added)
  useEffect(() => {
    setColWidths((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const col of allColumns) {
        if (!(col.key in next)) {
          next[col.key] = getDefaultWidth(col);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allColumns, getDefaultWidth]);

  // Resize drag state (refs to avoid re-renders during drag)
  const resizeDrag = useRef<{
    colKey: string;
    startX: number;
    startWidth: number;
    minW: number;
  } | null>(null);

  const onResizeStart = useCallback(
    (e: React.MouseEvent, colKey: string, minW: number) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = colWidths[colKey] ?? DEFAULT_COL_WIDTH;
      resizeDrag.current = { colKey, startX: e.clientX, startWidth, minW };

      const onMouseMove = (ev: MouseEvent): void => {
        const drag = resizeDrag.current;
        if (!drag) return;
        const delta = ev.clientX - drag.startX;
        const newWidth = Math.max(drag.minW, drag.startWidth + delta);
        setColWidths((prev) => ({ ...prev, [drag.colKey]: newWidth }));
      };

      const onMouseUp = (): void => {
        resizeDrag.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [colWidths],
  );

  // Ref to the active portal editor — for saveValue() before navigation
  const editorRef = useRef<CellEditorRef | null>(null);
  // Map of cell DOM nodes for getBoundingClientRect()
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  const tableRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  // Editable columns for navigation
  const editableCols = columns.filter((c) => c.editable && c.onEdit);

  const toggleSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange?.([...next]);
        return next;
      });
    },
    [onSelectionChange],
  );

  const toggleAll = useCallback(() => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(data.map(getRowId));
      setSelectedIds(all);
      onSelectionChange?.([...all]);
    }
  }, [data, selectedIds.size, getRowId, onSelectionChange]);

  const openEditor = useCallback((rowId: string, colKey: string, initialKey?: string) => {
    const cellKey = `${rowId}-${colKey}`;
    const cellEl = cellRefs.current.get(cellKey);
    if (!cellEl) return;
    const rect = cellEl.getBoundingClientRect();
    setPortalRect(rect);
    setEditorInitialKey(initialKey);
    setEditingCell({ rowId, colKey });
  }, []);

  const handleCommit = useCallback((value?: string) => {
    if (editingCell) {
      const col = columns.find((c) => c.key === editingCell.colKey);
      if (col?.onEdit && value !== undefined) {
        col.onEdit(editingCell.rowId, value);
      }
    }
    setEditingCell(null);
    setPortalRect(null);
    setEditorInitialKey(undefined);
  }, [editingCell, columns]);

  const handleCancel = useCallback(() => {
    setEditingCell(null);
    setPortalRect(null);
    setEditorInitialKey(undefined);
  }, []);

  // Move selection by delta in editable columns
  const moveSelection = useCallback((
    rowDelta: number,
    colDelta: number,
    fromCell?: SelectedCell,
  ) => {
    const cell = fromCell ?? selectedCell;
    if (!cell) return;

    const editableColKeys = editableCols.map((c) => c.key);
    const currentEditableColIdx = editableColKeys.indexOf(cell.colKey);

    let newRowIndex = cell.rowIndex;
    let newColIdx = currentEditableColIdx;

    if (colDelta !== 0) {
      newColIdx = currentEditableColIdx + colDelta;
      if (newColIdx < 0) {
        newColIdx = editableColKeys.length - 1;
        newRowIndex = Math.max(0, cell.rowIndex - 1);
      } else if (newColIdx >= editableColKeys.length) {
        newColIdx = 0;
        newRowIndex = Math.min(data.length - 1, cell.rowIndex + 1);
      }
    } else {
      newRowIndex = Math.max(0, Math.min(data.length - 1, cell.rowIndex + rowDelta));
    }

    const newColKey = editableColKeys[newColIdx];
    if (!newColKey) return;

    const newColIndex = columns.findIndex((c) => c.key === newColKey);
    const newRow = data[newRowIndex];
    if (!newRow) return;

    const newRowId = getRowId(newRow);
    setSelectedCell({ rowId: newRowId, colKey: newColKey, colIndex: newColIndex, rowIndex: newRowIndex });
  }, [selectedCell, editableCols, columns, data, getRowId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // --- Editing state ---
      if (editingCell) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleCancel();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const curSel = selectedCell;
          editorRef.current?.saveValue?.();
          setEditingCell(null);
          setPortalRect(null);
          setEditorInitialKey(undefined);
          if (curSel) {
            moveSelection(0, e.shiftKey ? -1 : 1, curSel);
          }
          return;
        }
        if (e.key === "Enter") {
          // Let the editor handle Enter internally (commit + move down)
          return;
        }
        return;
      }

      // --- Selected (not editing) state ---
      if (selectedCell) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSelectedCell(null);
          return;
        }
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          openEditor(selectedCell.rowId, selectedCell.colKey);
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          moveSelection(0, e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          moveSelection(0, 1);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveSelection(0, -1);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveSelection(1, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          moveSelection(-1, 0);
          return;
        }
        // Printable key → open editor and seed the key
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          openEditor(selectedCell.rowId, selectedCell.colKey, e.key);
          return;
        }
        return;
      }

      // --- No selection ---
      if (e.key === "Escape") {
        setCtxMenu(null);
      }
    },
    [editingCell, selectedCell, handleCancel, moveSelection, openEditor],
  );

  // Dismiss editor on outside click
  useEffect(() => {
    if (!editingCell && !selectedCell) return;
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node;
      // Check portal
      if (portalRef.current?.contains(target)) return;
      // Check all cell refs
      for (const [, el] of cellRefs.current) {
        if (el.contains(target)) return;
      }
      // Outside click — commit if editing, then clear
      if (editingCell) {
        editorRef.current?.saveValue?.();
        setEditingCell(null);
        setPortalRect(null);
        setEditorInitialKey(undefined);
      }
      setSelectedCell(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingCell, selectedCell]);

  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = (): void => setCtxMenu(null);
    document.addEventListener("click", dismiss);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("scroll", dismiss, true);
    };
  }, [ctxMenu]);

  if (data.length === 0 && emptyIcon) {
    return (
      <EmptyState
        Icon={emptyIcon}
        heading={emptyHeading ?? "No records found"}
        description={emptyDescription ?? "Try adjusting your filters or create a new record."}
        action={emptyAction}
      />
    );
  }

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-stone-500">
        {emptyHeading ?? "No records found"}
      </p>
    );
  }

  const firstColumnKey = columns[0]?.key;

  // Active editing row/col for portal
  const activeRow = editingCell ? data.find((r) => getRowId(r) === editingCell.rowId) : undefined;
  const activeCol = editingCell ? columns.find((c) => c.key === editingCell.colKey) : undefined;

  const handleEditorCommit = (value: string) => {
    handleCommit(value);
    // Move selection down after Enter commit
    if (selectedCell) {
      moveSelection(1, 0, selectedCell);
    }
  };

  // Compute total table width from column widths
  const totalWidth =
    (onSelectionChange ? CHECKBOX_COL_WIDTH : 0) +
    columns.reduce((sum, col) => sum + (colWidths[col.key] ?? DEFAULT_COL_WIDTH), 0) +
    ADD_COL_WIDTH;

  return (
    <div
      ref={tableRef}
      className="relative w-full overflow-x-auto outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <table
        className="border-collapse text-[13px]"
        style={{ tableLayout: "fixed", width: totalWidth }}
      >
        {/* Column width definitions */}
        <colgroup>
          {onSelectionChange && <col style={{ width: CHECKBOX_COL_WIDTH }} />}
          {columns.map((col) => (
            <col key={col.key} style={{ width: colWidths[col.key] ?? DEFAULT_COL_WIDTH }} />
          ))}
          <col style={{ width: ADD_COL_WIDTH }} />
        </colgroup>

        {/* Sticky header */}
        <thead className="sticky top-0 z-20 bg-white dark:bg-stone-950">
          <tr>
            {/* Checkbox header */}
            {onSelectionChange && (
              <th className="border-b border-stone-100 px-2 py-0 dark:border-stone-800">
                <div className="flex h-9 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === data.length && data.length > 0}
                    onChange={toggleAll}
                    className="size-3.5 rounded border-stone-300 accent-indigo-500 dark:border-stone-600"
                  />
                </div>
              </th>
            )}

            {/* Column headers with resize handles */}
            {columns.map((col, colIndex) => {
              const isFirst = colIndex === 0;
              const isActive = sort === col.key;
              const Icon = col.icon;

              return (
                <th
                  key={col.key}
                  className={cn(
                    "relative border-b border-stone-100 py-0 text-left dark:border-stone-800",
                    isFirst && "sticky left-0 z-10 bg-white dark:bg-stone-950",
                    col.sortable && onSort && "cursor-pointer select-none",
                  )}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div
                    className={cn(
                      "flex h-9 items-center gap-1.5 overflow-hidden px-3 text-xs font-medium text-stone-500",
                      col.align === "right" && "justify-end",
                    )}
                  >
                    {Icon && <Icon className="size-3.5 shrink-0 text-stone-400" />}
                    <span className="truncate">{col.label}</span>
                    {col.sortable && isActive && (
                      sortDir === "asc"
                        ? <ChevronUp className="size-3 shrink-0 text-stone-500" />
                        : <ChevronDown className="size-3 shrink-0 text-stone-500" />
                    )}
                  </div>
                  {/* Resize handle */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    className="absolute -right-px top-0 z-20 flex h-full w-[5px] cursor-col-resize items-center justify-center hover:bg-indigo-500/20 active:bg-indigo-500/30"
                    onMouseDown={(e) => onResizeStart(e, col.key, col.minWidth ?? MIN_COL_WIDTH)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="h-4 w-px bg-stone-200 transition-colors group-hover:bg-stone-400 dark:bg-stone-700" />
                  </div>
                </th>
              );
            })}

            {/* Add column — inline popover */}
            <th className="border-b border-stone-100 px-2 py-0 dark:border-stone-800">
              <div className="flex h-9 items-center">
                {entity && onToggleColumn ? (
                  <AddColumnPopover
                    allColumns={allColumns.map((c) => ({ key: c.key, label: c.label }))}
                    hiddenColumns={hiddenColumns ?? new Set()}
                    onToggle={onToggleColumn}
                    entity={entity}
                    onFieldCreated={onFieldCreated ?? (() => undefined)}
                  />
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 text-xs text-stone-300 dark:text-stone-600">
                    <Plus className="size-3" />
                    Add column
                  </span>
                )}
              </div>
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {data.map((row, rowIndex) => {
            const rowId = getRowId(row);
            const isRowSelected = selectedIds.has(rowId);

            return (
              <tr
                key={rowId}
                className={cn(
                  "group border-b border-stone-100 transition-colors dark:border-stone-800",
                  isRowSelected
                    ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                    : "hover:bg-stone-50 dark:hover:bg-stone-900",
                )}
                onContextMenu={(e) => {
                  if (!contextMenuItems) return;
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, row });
                }}
              >
                {/* Checkbox cell */}
                {onSelectionChange && (
                  <td
                    className="px-2 py-0 align-top"
                    onClick={(e) => { e.stopPropagation(); toggleSelection(rowId); }}
                  >
                    <div className="flex min-h-9 items-center justify-center py-1.5">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleSelection(rowId)}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "size-3.5 rounded border-stone-300 accent-indigo-500 transition-opacity dark:border-stone-600",
                          isRowSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        )}
                      />
                    </div>
                  </td>
                )}

                {/* Data cells */}
                {columns.map((col, colIndex) => {
                  const isFirst = colIndex === 0 && col.key === firstColumnKey;
                  const isEditable = col.editable && col.onEdit;
                  const isCellSelected = selectedCell?.rowId === rowId && selectedCell?.colKey === col.key;
                  const isCellEditing = editingCell?.rowId === rowId && editingCell?.colKey === col.key;
                  const cellKey = `${rowId}-${col.key}`;

                  return (
                    <td
                      key={col.key}
                      ref={(el) => {
                        if (el) cellRefs.current.set(cellKey, el);
                        else cellRefs.current.delete(cellKey);
                      }}
                      className={cn(
                        "overflow-hidden px-3 py-0",
                        isFirst && "sticky left-0 z-10",
                        isFirst && (isRowSelected
                          ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                          : "bg-white group-hover:bg-stone-50 dark:bg-stone-950 dark:group-hover:bg-stone-900"),
                        col.align === "right" && "text-right",
                        isFirst && onRowClick && "cursor-pointer",
                        !isFirst && isEditable && !isCellEditing && "cursor-text",
                      )}
                      onDoubleClick={(e) => {
                        if (!isFirst && isEditable) {
                          e.stopPropagation();
                          openEditor(rowId, col.key);
                        }
                      }}
                      onClick={(e) => {
                        if (isFirst && onRowClick) {
                          onRowClick(row);
                        } else if (!isFirst && isEditable) {
                          e.stopPropagation();
                          if (isCellSelected) {
                            openEditor(rowId, col.key);
                          } else {
                            setSelectedCell({ rowId, colKey: col.key, colIndex, rowIndex });
                            setEditingCell(null);
                          }
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "flex min-h-9 min-w-0 items-center py-1.5",
                          col.align === "right" && "justify-end",
                          !isFirst && isEditable && !isCellEditing && "rounded ring-inset transition-shadow hover:ring-1 hover:ring-stone-200 dark:hover:ring-stone-700",
                          !isFirst && isEditable && isCellSelected && !isCellEditing && "ring-2 ring-indigo-400",
                          !isFirst && isEditable && isCellEditing && "ring-2 ring-indigo-400/40",
                        )}
                      >
                        <div className="min-w-0 max-w-full break-words">
                          {col.render(row)}
                        </div>
                      </div>
                    </td>
                  );
                })}

                {/* Empty trailing cell to fill row */}
                <td className="py-0" />
              </tr>
            );
          })}
        </tbody>

        {/* Footer count row */}
        <tfoot>
          <tr>
            {onSelectionChange && <td className="py-0" />}
            <td className="px-3 py-1.5" colSpan={1}>
              <span className="text-xs text-stone-400">
                {data.length} {data.length === 1 ? "record" : "records"}
              </span>
            </td>
            {columns.length > 1 && (
              <td colSpan={columns.length - 1 + 1} className="py-0" />
            )}
          </tr>
        </tfoot>
      </table>

      {/* Portal editor overlay */}
      {editingCell && portalRect && activeCol && activeRow !== undefined && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: "fixed",
              top: portalRect.top,
              left: portalRect.left,
              width: Math.max(portalRect.width, 200),
              zIndex: 9999,
            }}
            className="rounded-md border-2 border-indigo-400 shadow-lg bg-white dark:bg-stone-900"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CellEditor
              ref={editorRef}
              col={activeCol}
              row={activeRow}
              onCommit={handleEditorCommit}
              onCancel={handleCancel}
              initialKey={editorInitialKey}
            />
          </div>,
          document.body,
        )
      }

      {/* Context menu */}
      {ctxMenu && contextMenuItems && (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {contextMenuItems(ctxMenu.row).map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-stone-100 dark:hover:bg-stone-800",
                item.destructive && "text-red-600 dark:text-red-400",
              )}
              onClick={() => {
                item.onClick();
                setCtxMenu(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CellEditor — portal editor with useImperativeHandle
// ---------------------------------------------------------------------------

interface CellEditorProps<T> {
  col: ColumnDef<T>;
  row: T;
  onCommit: (value: string) => void;
  onCancel: () => void;
  initialKey?: string | undefined;
}

const CellEditor = forwardRef(function CellEditor<T>(
  { col, row, onCommit, onCancel, initialKey }: CellEditorProps<T>,
  ref: React.Ref<CellEditorRef>,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  const seedValue = initialKey ?? col.editValue?.(row) ?? String(col.sortValue?.(row) ?? "");
  const valueRef = useRef<string>(seedValue);
  // For multi_select we track an array
  const multiSelectedRef = useRef<string[]>(
    col.editType === "multi_select" && seedValue
      ? seedValue.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  );

  // Must be declared before any conditional returns (Rules of Hooks)
  const [multiSelected, setMultiSelected] = useState<string[]>(multiSelectedRef.current);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
      selectRef.current?.focus();
    },
    saveValue: () => {
      if (col.editType === "boolean" || col.editType === "select") return; // commit immediately
      if (col.editType === "multi_select") {
        onCommit(multiSelectedRef.current.join(","));
        return;
      }
      onCommit(valueRef.current);
    },
  }));

  // Boolean editor — two visible buttons
  if (col.editType === "boolean") {
    const currentVal = col.editValue?.(row) ?? "false";
    const isTrue = currentVal === "true";
    return (
      <div className="flex items-center gap-1 px-1 py-1">
        <button
          type="button"
          autoFocus={isTrue}
          onClick={() => onCommit("true")}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
            isTrue
              ? "bg-indigo-500 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-stone-800 dark:text-stone-300",
          )}
        >
          <Check className="size-3" />
          Yes
        </button>
        <button
          type="button"
          autoFocus={!isTrue}
          onClick={() => onCommit("false")}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
            !isTrue
              ? "bg-stone-500 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300",
          )}
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        >
          No
        </button>
      </div>
    );
  }

  // Select editor — custom dropdown with colored dots
  if (col.editType === "select" && col.editOptions) {
    return (
      <div className="flex flex-col py-1">
        <button
          type="button"
          onClick={() => onCommit("")}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-400 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          — none —
        </button>
        {col.editOptions.map((opt) => {
          const isActive = seedValue === opt.value || seedValue === opt.label;
          const colors = opt.color ? getOptionColor(opt.color) : null;
          return (
            <button
              key={opt.value}
              type="button"
              autoFocus={isActive}
              onClick={() => onCommit(opt.value)}
              onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-stone-50 dark:hover:bg-stone-800",
                isActive ? "bg-stone-50 dark:bg-stone-800" : "",
              )}
            >
              {colors && <span className={cn("size-2 rounded-full", colors.dot)} />}
              <span className="text-stone-700 dark:text-stone-300">{opt.label}</span>
              {isActive && <Check className="ml-auto size-3 text-indigo-500" />}
            </button>
          );
        })}
      </div>
    );
  }

  // Multi-select editor — checkmark list with colored dots
  if (col.editType === "multi_select" && col.editOptions) {
    return (
      <div className="flex flex-col py-1">
        {col.editOptions.map((opt) => {
          const isChecked = multiSelected.includes(opt.value);
          const colors = opt.color ? getOptionColor(opt.color) : null;
          const toggle = () => {
            const next = isChecked
              ? multiSelected.filter((v) => v !== opt.value)
              : [...multiSelected, opt.value];
            setMultiSelected(next);
            multiSelectedRef.current = next;
          };
          return (
            <button
              key={opt.value}
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-700 transition-colors hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              <span className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                isChecked
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-stone-300 dark:border-stone-600",
              )}>
                {isChecked && <Check className="size-2.5" />}
              </span>
              {colors && <span className={cn("size-2 rounded-full", colors.dot)} />}
              {opt.label}
            </button>
          );
        })}
        <div className="flex justify-end gap-1 border-t border-stone-100 px-2 py-1.5 dark:border-stone-800">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCommit(multiSelectedRef.current.join(","))}
            className="rounded bg-indigo-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-600"
          >
            Apply
          </button>
        </div>
      </div>
    );
  }

  // Text, number, date, url, phone
  const inputType =
    col.editType === "number" ? "number" :
    col.editType === "date" ? "date" : "text";

  // When opened via printable key, seed value = initialKey and cursor at end
  const defaultValue = initialKey !== undefined ? initialKey : seedValue;

  return (
    <Input
      ref={inputRef}
      defaultValue={defaultValue}
      onChange={(e) => { valueRef.current = e.target.value; }}
      onBlur={() => onCommit(valueRef.current)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(valueRef.current);
        }
        // Tab is handled by parent keyboard nav (saveValue called before move)
        if (e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          onCommit(valueRef.current);
        }
      }}
      type={inputType}
      autoFocus
      className="h-9 rounded-none border-0 text-[13px] shadow-none focus-visible:ring-0"
    />
  );
}) as <T>(props: CellEditorProps<T> & { ref?: React.Ref<CellEditorRef> }) => JSX.Element;
