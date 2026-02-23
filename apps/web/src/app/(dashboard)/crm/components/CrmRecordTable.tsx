"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  Input,
  cn,
} from "@basicsos/ui";
import { ChevronUp, ChevronDown } from "@basicsos/ui";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface ColumnDef<T> {
  key: string;
  label: string;
  icon?: React.ElementType;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  width?: string;
  align?: "left" | "right";
  editable?: boolean;
  editType?: "text" | "select" | "number" | "date";
  editOptions?: Array<{ label: string; value: string }>;
  onEdit?: (rowId: string, value: string) => void;
}

interface CrmRecordTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  onRowClick?: ((row: T) => void) | undefined;
  onSelectionChange?: ((ids: string[]) => void) | undefined;
  hiddenColumns?: Set<string> | undefined;
  sort?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  onSort?: ((field: string) => void) | undefined;
  contextMenuItems?: ((row: T) => Array<{ label: string; onClick: () => void; destructive?: boolean }>) | undefined;
  emptyIcon?: LucideIcon | undefined;
  emptyHeading?: string | undefined;
  emptyDescription?: string | undefined;
  emptyAction?: React.ReactNode | undefined;
}

export function CrmRecordTable<T>({
  data,
  columns: allColumns,
  getRowId,
  onRowClick,
  onSelectionChange,
  hiddenColumns,
  sort,
  sortDir,
  onSort,
  contextMenuItems,
  emptyIcon,
  emptyHeading = "No records found",
  emptyDescription = "Try adjusting your filters or create a new record.",
  emptyAction,
}: CrmRecordTableProps<T>): JSX.Element {
  const columns = hiddenColumns?.size
    ? allColumns.filter((col) => !hiddenColumns.has(col.key))
    : allColumns;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: T } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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

  const startEdit = useCallback((rowId: string, colKey: string, currentValue: string) => {
    setEditingCell({ rowId, colKey });
    setEditValue(currentValue);
  }, []);

  const commitEdit = useCallback((col: ColumnDef<T>) => {
    if (editingCell && col.onEdit) {
      col.onEdit(editingCell.rowId, editValue);
    }
    setEditingCell(null);
  }, [editingCell, editValue]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, data.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusedIndex >= 0 && onRowClick) {
        e.preventDefault();
        onRowClick(data[focusedIndex]!);
      } else if (e.key === " " && focusedIndex >= 0 && onSelectionChange) {
        e.preventDefault();
        toggleSelection(getRowId(data[focusedIndex]!));
      } else if (e.key === "Escape") {
        setFocusedIndex(-1);
        setCtxMenu(null);
      }
    },
    [editingCell, focusedIndex, data, onRowClick, onSelectionChange, toggleSelection, getRowId],
  );

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

  return (
    <div
      ref={tableRef}
      className="overflow-x-auto outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <Table>
        <TableHeader>
          <TableRow>
            {onSelectionChange && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === data.length && data.length > 0}
                  onChange={toggleAll}
                  className="size-3.5 rounded border-stone-300 dark:border-stone-600"
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <SortableHead
                key={col.key}
                col={col}
                sort={sort}
                sortDir={sortDir}
                onSort={onSort}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => {
            const rowId = getRowId(row);
            return (
              <TableRow
                key={rowId}
                className={cn(
                  "transition-colors hover:bg-accent/50",
                  onRowClick && "cursor-pointer",
                  selectedIds.has(rowId) && "bg-accent/30",
                  focusedIndex === rowIndex && "ring-1 ring-primary/40 bg-accent/20",
                )}
                onClick={() => {
                  setFocusedIndex(rowIndex);
                  onRowClick?.(row);
                }}
                onContextMenu={(e) => {
                  if (!contextMenuItems) return;
                  e.preventDefault();
                  setFocusedIndex(rowIndex);
                  setCtxMenu({ x: e.clientX, y: e.clientY, row });
                }}
              >
                {onSelectionChange && (
                  <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(rowId)}
                      onChange={() => toggleSelection(rowId)}
                      className="size-3.5 rounded border-stone-300 dark:border-stone-600"
                    />
                  </TableCell>
                )}
                {columns.map((col) => {
                  const isEditing = editingCell?.rowId === rowId && editingCell?.colKey === col.key;
                  return (
                    <TableCell
                      key={col.key}
                      className={cn(col.width, col.align === "right" && "text-right")}
                      onClick={(e) => {
                        if (col.editable && col.onEdit) {
                          e.stopPropagation();
                          const val = col.sortValue ? String(col.sortValue(row)) : "";
                          startEdit(rowId, col.key, val);
                        }
                      }}
                    >
                      {isEditing && col.editable ? (
                        <EditableCell
                          col={col}
                          value={editValue}
                          onChange={setEditValue}
                          onCommit={() => commitEdit(col)}
                          onCancel={cancelEdit}
                        />
                      ) : (
                        <span className={cn(col.editable && col.onEdit && "group-hover:opacity-90")}>
                          {col.render(row)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {ctxMenu && contextMenuItems && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border border-stone-200 bg-white p-1 shadow-overlay dark:border-stone-700 dark:bg-stone-900"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {contextMenuItems(ctxMenu.row).map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-stone-100 dark:hover:bg-stone-800",
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

function SortableHead<T>({
  col,
  sort,
  sortDir,
  onSort,
}: {
  col: ColumnDef<T>;
  sort?: string | undefined;
  sortDir?: "asc" | "desc" | undefined;
  onSort?: ((field: string) => void) | undefined;
}): JSX.Element {
  const isActive = sort === col.key;
  const Icon = col.icon;

  return (
    <TableHead
      className={cn(
        col.width,
        col.align === "right" && "text-right",
        col.sortable && onSort && "cursor-pointer select-none hover:text-foreground",
      )}
      onClick={() => col.sortable && onSort?.(col.key)}
    >
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {col.label}
        {col.sortable && isActive && (
          sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
        )}
      </span>
    </TableHead>
  );
}

function EditableCell<T>({
  col,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  col: ColumnDef<T>;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}): JSX.Element {
  if (col.editType === "select" && col.editOptions) {
    return (
      <select
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter") onCommit();
        }}
        autoFocus
        className="w-full rounded-md border border-stone-300 bg-paper px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-800"
      >
        {col.editOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          onCommit();
        }
      }}
      type={col.editType === "number" ? "number" : "text"}
      autoFocus
      className="h-7 text-sm"
    />
  );
}
