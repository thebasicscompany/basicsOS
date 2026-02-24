"use client";

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import type { ComponentType, SVGProps } from "react";
import {
  EmptyState,
  Input,
  cn,
  CaretUp,
  CaretDown,
  Plus,
  Check,
  MagnifyingGlass,
  Hash,
  Calendar,
  List,
  Phone,
  Envelope,
  Link,
  ToggleLeft,
} from "@basicsos/ui";
import { trpc } from "@/lib/trpc";
import { addToast } from "@basicsos/ui";

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
  width?: string;
  align?: "left" | "right";
  editable?: boolean;
  editType?: "text" | "select" | "multi_select" | "number" | "date" | "boolean" | "url" | "phone" | "email" | undefined;
  editOptions?: Array<{ label: string; value: string }> | undefined;
  onEdit?: ((rowId: string, value: string) => void) | undefined;
}

const FIELD_TYPES = [
  { value: "text", label: "Text", icon: MagnifyingGlass },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: Calendar },
  { value: "boolean", label: "Checkbox", icon: ToggleLeft },
  { value: "select", label: "Select", icon: List },
  { value: "multi_select", label: "Multi-select", icon: List },
  { value: "url", label: "URL", icon: Link },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "email", label: "Email", icon: Envelope },
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
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const createField = trpc.crm.customFieldDefs.create.useMutation({
    onSuccess: () => {
      addToast({ title: "Field created", variant: "success" });
      void utils.crm.customFieldDefs.list.invalidate({ entity });
      onFieldCreated();
      setNewFieldName("");
      setNewFieldType("text");
      setCreating(false);
      setOpen(false);
    },
    onError: (err) => addToast({ title: "Failed to create field", description: err.message, variant: "destructive" }),
  });

  const handleCreate = (): void => {
    const label = newFieldName.trim();
    if (!label) return;
    createField.mutate({ entity, key: labelToKey(label), label, type: newFieldType });
  };

  const calcPos = (width: number, height: number): { top: number; left: number } => {
    if (!btnRef.current) return { top: 0, left: 0 };
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const top = spaceBelow >= height || spaceBelow >= rect.top
      ? rect.bottom + 4
      : Math.max(4, rect.top - height - 4);
    const left = Math.max(4, Math.min(rect.left, vw - width - 8));
    return { top, left };
  };

  const openPanel = (): void => {
    if (!btnRef.current) return;
    setPanelPos(calcPos(224, 320));
    setOpen(true);
    setCreating(false);
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
        setCreating(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = allColumns.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

  const panel = open && panelPos ? (
    !creating ? (
      <div
        ref={panelRef}
        className="fixed z-[9999] w-56 rounded-sm border border-border bg-popover shadow-xl"
        style={{ top: panelPos.top, left: panelPos.left }}
      >
        {/* Search */}
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
          <MagnifyingGlass className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            placeholder="Search attributes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
              >
                <span className={cn(
                  "flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                  visible
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input",
                )}>
                  {visible && <Check className="size-2.5" />}
                </span>
                <span className="flex-1 text-left">{col.label}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No attributes found</p>
          )}
        </div>

        {/* Divider + Create */}
        <div className="border-t border-border py-1">
          <button
            type="button"
            onClick={() => { setPanelPos(calcPos(256, 400)); setCreating(true); setSearch(""); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            <span>Create new field</span>
          </button>
        </div>
      </div>
    ) : (
      <div
        ref={panelRef}
        className="fixed z-[9999] w-64 rounded-sm border border-border bg-popover shadow-xl"
        style={{ top: panelPos.top, left: panelPos.left }}
      >
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-medium text-foreground">Create field</p>
        </div>
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Name</label>
            <Input
              autoFocus
              placeholder="Field name..."
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Type</label>
            <div className="grid grid-cols-2 gap-1">
              {FIELD_TYPES.map((ft) => {
                const Icon = ft.icon;
                return (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setNewFieldType(ft.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs transition-colors",
                      newFieldType === ft.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-border hover:bg-accent",
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
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={() => { setPanelPos(calcPos(224, 320)); setCreating(false); }}
            className="rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!newFieldName.trim() || createField.isPending}
            onClick={handleCreate}
            className="rounded-sm bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {createField.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    )
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPanel}
        className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
}: CrmRecordTableProps<T>): JSX.Element {
  const columns = hiddenColumns?.size
    ? allColumns.filter((col) => !hiddenColumns.has(col.key))
    : allColumns;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Stage 1: cell is selected (highlighted ring, no editor open)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  // Stage 2: cell is actively being edited (portal editor open)
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  // Initial key seeded into editor when opened via printable key
  const [editorInitialKey, setEditorInitialKey] = useState<string | undefined>(undefined);
  // Portal position (from getBoundingClientRect)
  const [portalRect, setPortalRect] = useState<DOMRect | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: T } | null>(null);

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
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
      onSelectionChange?.([...next]);
    },
    [selectedIds, onSelectionChange],
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
      <p className="py-8 text-center text-sm text-muted-foreground">
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

  return (
    <div
      ref={tableRef}
      className="relative w-full overflow-x-auto outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <table className="w-full border-collapse text-[13px]">
        {/* Sticky header */}
        <thead className="sticky top-0 z-20 bg-background">
          <tr>
            {/* Checkbox header */}
            {onSelectionChange && (
              <th
                className="w-9 border-b border-border px-2 py-0"
                style={{ width: 36 }}
              >
                <div className="flex h-9 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === data.length && data.length > 0}
                    onChange={toggleAll}
                    className="size-3.5 rounded border-input accent-primary"
                  />
                </div>
              </th>
            )}

            {/* Column headers */}
            {columns.map((col, colIndex) => {
              const isFirst = colIndex === 0;
              const isActive = sort === col.key;
              const Icon = col.icon;

              return (
                <th
                  key={col.key}
                  className={cn(
                    "border-b border-border px-3 py-0 text-left",
                    isFirst && "sticky left-0 z-10 bg-background",
                    col.sortable && onSort && "cursor-pointer select-none",
                  )}
                  style={isFirst ? { minWidth: 220, width: 220 } : col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div
                    className={cn(
                      "flex h-9 items-center gap-1.5 text-xs font-medium text-muted-foreground",
                      col.align === "right" && "justify-end",
                    )}
                  >
                    {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span>{col.label}</span>
                    {col.sortable && isActive && (
                      sortDir === "asc"
                        ? <ChevronUp className="size-3 shrink-0 text-muted-foreground" />
                        : <CaretDown className="size-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </th>
              );
            })}

            {/* Add column — inline popover */}
            <th className="border-b border-border px-2 py-0">
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
                  <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground/40">
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
                  "group border-b border-border transition-colors",
                  isRowSelected
                    ? "bg-primary/5"
                    : "hover:bg-accent/50",
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
                    className="w-9 px-2 py-0"
                    style={{ width: 36 }}
                    onClick={(e) => { e.stopPropagation(); toggleSelection(rowId); }}
                  >
                    <div className="flex h-9 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleSelection(rowId)}
                        className={cn(
                          "size-3.5 rounded border-input accent-primary transition-opacity",
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
                        "px-3 py-0",
                        isFirst && "sticky left-0 z-10",
                        isFirst && (isRowSelected
                          ? "bg-primary/5"
                          : "bg-background group-hover:bg-accent/50"),
                        col.align === "right" && "text-right",
                        isFirst && onRowClick && "cursor-pointer",
                        !isFirst && isEditable && !isCellEditing && "cursor-text",
                      )}
                      style={isFirst ? { minWidth: 220, width: 220 } : col.width ? { width: col.width } : undefined}
                      onClick={(e) => {
                        if (isFirst && onRowClick) {
                          onRowClick(row);
                        } else if (!isFirst && isEditable) {
                          e.stopPropagation();
                          if (isCellSelected) {
                            // Second click → open editor
                            openEditor(rowId, col.key);
                          } else {
                            // First click → select cell
                            setSelectedCell({ rowId, colKey: col.key, colIndex, rowIndex });
                            setEditingCell(null);
                          }
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "flex h-9 items-center",
                          col.align === "right" && "justify-end",
                          !isFirst && isEditable && !isCellEditing && "rounded ring-inset transition-shadow hover:ring-1 hover:ring-border",
                          !isFirst && isEditable && isCellSelected && !isCellEditing && "ring-2 ring-primary",
                          !isFirst && isEditable && isCellEditing && "ring-2 ring-primary/40",
                        )}
                      >
                        {col.render(row)}
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
            {onSelectionChange && <td className="py-0" style={{ width: 36 }} />}
            <td className="px-3 py-1.5" colSpan={1}>
              <span className="text-xs text-muted-foreground">
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
            className="rounded-sm border-2 border-primary shadow-lg bg-card"
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
          className="fixed z-50 min-w-[160px] rounded-sm border border-border bg-popover p-1 shadow-lg"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {contextMenuItems(ctxMenu.row).map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-[13px] transition-colors hover:bg-accent",
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
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
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
              ? "bg-secondary text-secondary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        >
          No
        </button>
      </div>
    );
  }

  // Select editor — native dropdown
  if (col.editType === "select" && col.editOptions) {
    return (
      <select
        ref={selectRef}
        defaultValue={seedValue}
        onChange={(e) => {
          valueRef.current = e.target.value;
          onCommit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        className="w-full rounded-sm border-0 bg-transparent px-2 py-1.5 text-[13px] text-foreground outline-none"
      >
        <option value="">— none —</option>
        {col.editOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  // Multi-select editor — checkmark list
  if (col.editType === "multi_select" && col.editOptions) {
    const [selected, setSelected] = useState<string[]>(multiSelectedRef.current);
    return (
      <div className="flex flex-col py-1">
        {col.editOptions.map((opt) => {
          const isChecked = selected.includes(opt.value);
          const toggle = () => {
            const next = isChecked
              ? selected.filter((v) => v !== opt.value)
              : [...selected, opt.value];
            setSelected(next);
            multiSelectedRef.current = next;
          };
          return (
            <button
              key={opt.value}
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
            >
              <span className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                isChecked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input",
              )}>
                {isChecked && <Check className="size-2.5" />}
              </span>
              {opt.label}
            </button>
          );
        })}
        <div className="flex justify-end gap-1 border-t border-border px-2 py-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCommit(multiSelectedRef.current.join(","))}
            className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply
          </button>
        </div>
      </div>
    );
  }

  // Text, number, date, url, phone, email
  const inputType =
    col.editType === "number" ? "number" :
    col.editType === "date" ? "date" :
    col.editType === "url" ? "url" :
    col.editType === "email" ? "email" :
    col.editType === "phone" ? "tel" : "text";

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
