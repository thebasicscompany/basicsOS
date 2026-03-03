import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTableColumns,
  type NocoDBColumn,
} from "@/hooks/use-columns";
import { useGridPreferences, type RowHeight } from "@/hooks/use-grid-preferences";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { SpreadsheetCell } from "./SpreadsheetCell";
import { SpreadsheetToolbar } from "./SpreadsheetToolbar";
import { RowNumberCell } from "./RowNumberCell";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { useCellEditing } from "./use-cell-editing";
import { getTypeIcon } from "./type-icons";
import type { SortDef } from "./SortPopover";
import type { FilterDef } from "./FilterPopover";

type Row = Record<string, unknown> & { id?: number | string };

export interface SpreadsheetGridProps {
  /** NocoDB resource name (e.g. "contacts", "companies") */
  resource: string;
  /** Data rows */
  data: Row[];
  /** Total rows for pagination display */
  total?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Called when a cell value is committed via inline edit */
  onCellUpdate?: (rowId: number | string, field: string, value: unknown) => void;
  /** Bulk delete handler; enables row selection when provided */
  onBulkDelete?: (ids: number[]) => void | Promise<void>;
  /** Called when expand icon is clicked on a row */
  onRowExpand?: (row: Row) => void;
  /** Called when "+ New row" is clicked */
  onNewRow?: () => void;
  /** Columns that should not be editable */
  readOnlyColumns?: string[];
  /** Columns to hide from the grid */
  hiddenColumns?: string[];
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Extra toolbar content */
  toolbar?: React.ReactNode;
  /** Row height override */
  rowHeight?: RowHeight;
  /** All rows for prev/next navigation in expanded form */
  allRows?: Row[];
  /** Sticky first data column (default true) */
  stickyFirstColumn?: boolean;
  /** Default sorting state */
  defaultSorting?: SortingState;
  /** Sort change callback */
  onSortChange?: (sorting: SortingState) => void;
  /** Filter change callback */
  onFilterChange?: (filters: FilterDef[]) => void;
}

/** System/metadata columns to always hide */
const DEFAULT_HIDDEN = new Set([
  "nc_order",
  "created_at",
  "updated_at",
  "CreatedAt",
  "UpdatedAt",
  "sales_id",
  "salesId",
  "avatar",
  "email_jsonb",
  "phone_jsonb",
  "custom_fields",
  "tags",
  "logo",
  "context_links",
]);

/** Columns that are always read-only */
const ALWAYS_READONLY = new Set(["id", "Id", "created_at", "updated_at"]);

/** Row height in pixels */
const ROW_HEIGHT_PX: Record<RowHeight, number> = {
  short: 32,
  medium: 40,
  tall: 56,
  extra: 80,
};

/** Convert NocoDB column name (snake_case) to camelCase accessor */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Build TanStack Table column definitions from NocoDB column metadata.
 */
function buildColumns(
  nocoColumns: NocoDBColumn[],
  hiddenColumns: Set<string>,
  readOnlyColumns: Set<string>,
  cellEditing: ReturnType<typeof useCellEditing>,
  onCellUpdate?: SpreadsheetGridProps["onCellUpdate"],
  activeRowIndex?: number,
  activeColId?: string,
): ColumnDef<Row>[] {
  return nocoColumns
    .filter((col) => {
      if (col.system && col.column_name !== "id") return false;
      if (DEFAULT_HIDDEN.has(col.column_name)) return false;
      if (hiddenColumns.has(col.column_name)) return false;
      if (hiddenColumns.has(toCamelCase(col.column_name))) return false;
      return true;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((col): ColumnDef<Row> => {
      const accessor = toCamelCase(col.column_name);
      const isReadOnly =
        col.pk ||
        col.ai ||
        ALWAYS_READONLY.has(col.column_name) ||
        readOnlyColumns.has(col.column_name) ||
        readOnlyColumns.has(accessor);

      return {
        id: accessor,
        accessorFn: (row) => row[accessor] ?? row[col.column_name],
        header: ({ column }) => (
          <ColumnHeader column={column} col={col} />
        ),
        cell: ({ row, column }) => {
          const rowId = row.original.id;
          if (rowId == null) return null;
          const value = row.getValue(column.id);
          const editing = cellEditing.isEditing(rowId, column.id);
          const selected = cellEditing.isSelected(rowId, column.id);
          const isActiveCell =
            row.index === activeRowIndex && column.id === activeColId;

          return (
            <SpreadsheetCell
              value={value}
              uidt={col.uidt}
              isEditing={editing}
              isSelected={selected || isActiveCell}
              readOnly={isReadOnly}
              isPrimary={col.pv}
              dtxp={col.dtxp}
              onSelect={() => cellEditing.select(rowId, column.id)}
              onStartEdit={() => cellEditing.startEditing(rowId, column.id)}
              onCommit={(newValue) => {
                cellEditing.cancelEditing();
                if (newValue !== value && onCellUpdate) {
                  onCellUpdate(rowId, col.column_name, newValue);
                }
              }}
              onCancel={() => cellEditing.cancelEditing()}
            />
          );
        },
        meta: { title: col.title || col.column_name, uidt: col.uidt, isPrimary: col.pv },
        enableSorting: !col.pk,
        size: col.uidt === "LongText" ? 250 : col.pk ? 60 : 150,
        minSize: 60,
      };
    });
}

function ColumnHeader({
  column,
  col,
}: {
  column: {
    getToggleSortingHandler: () => ((e: unknown) => void) | undefined;
    getIsSorted: () => false | "asc" | "desc";
  };
  col: NocoDBColumn;
}) {
  const sortHandler = column.getToggleSortingHandler();
  const sorted = column.getIsSorted();
  const Icon = getTypeIcon(col.uidt);
  const title = col.title || col.column_name;

  return (
    <button
      className="flex w-full items-center gap-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={sortHandler}
      title={`Sort by ${title}`}
    >
      {Icon && <Icon className="size-3 shrink-0 opacity-60" />}
      <span className="truncate">{title}</span>
      {sorted === "asc" && <span className="text-[10px]">&#9650;</span>}
      {sorted === "desc" && <span className="text-[10px]">&#9660;</span>}
    </button>
  );
}

const selectColumn: ColumnDef<Row> = {
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={
        table.getIsAllPageRowsSelected()
          ? true
          : table.getIsSomePageRowsSelected()
            ? "indeterminate"
            : false
      }
      onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(v) => row.toggleSelected(!!v)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Select row"
    />
  ),
  enableSorting: false,
  enableHiding: false,
  size: 40,
};

export function SpreadsheetGrid({
  resource,
  data,
  total,
  isLoading = false,
  onCellUpdate,
  onBulkDelete,
  onRowExpand,
  onNewRow,
  readOnlyColumns = [],
  hiddenColumns = [],
  searchPlaceholder,
  toolbar,
  stickyFirstColumn = true,
  defaultSorting,
  onSortChange: onSortChangeProp,
  onFilterChange: onFilterChangeProp,
}: SpreadsheetGridProps) {
  const prefs = useGridPreferences(resource);

  const [sorting, setSorting] = useState<SortingState>(
    defaultSorting ?? prefs.sorting,
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    prefs.columnVisibility,
  );
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [toolbarSorting, setToolbarSorting] = useState<SortDef[]>([]);
  const [toolbarFilters, setToolbarFilters] = useState<FilterDef[]>([]);

  // Apply toolbar filters client-side
  const filteredData = useMemo(() => {
    if (toolbarFilters.length === 0) return data;
    return data.filter((row) =>
      toolbarFilters.every((f) => {
        const raw = row[f.field] ?? row[toCamelCase(f.field)] ?? row[f.field.replace(/([A-Z])/g, '_$1').toLowerCase()];
        const val = raw == null ? "" : String(raw).toLowerCase();
        const target = f.value.toLowerCase();
        switch (f.op) {
          case "eq":
            return val === target;
          case "neq":
            return val !== target;
          case "like":
            return val.includes(target);
          case "nlike":
            return !val.includes(target);
          case "gt":
            return Number(raw) > Number(f.value);
          case "lt":
            return Number(raw) < Number(f.value);
          case "gte":
            return Number(raw) >= Number(f.value);
          case "lte":
            return Number(raw) <= Number(f.value);
          case "blank":
            return raw == null || val === "";
          case "notblank":
            return raw != null && val !== "";
          default:
            return true;
        }
      }),
    );
  }, [data, toolbarFilters]);

  const cellEditing = useCellEditing();
  const { data: nocoColumns, isLoading: columnsLoading } =
    useTableColumns(resource);

  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const readOnlySet = useMemo(
    () => new Set(readOnlyColumns),
    [readOnlyColumns],
  );

  // Keyboard navigation
  const visibleColumnIds = useMemo(() => {
    if (!nocoColumns) return [];
    return nocoColumns
      .filter((col) => {
        if (col.system && col.column_name !== "id") return false;
        if (DEFAULT_HIDDEN.has(col.column_name)) return false;
        if (hiddenSet.has(col.column_name)) return false;
        if (hiddenSet.has(toCamelCase(col.column_name))) return false;
        if (columnVisibility[toCamelCase(col.column_name)] === false) return false;
        return true;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((col) => toCamelCase(col.column_name));
  }, [nocoColumns, hiddenSet, columnVisibility]);

  const keyboard = useKeyboardNavigation({
    visibleColumnIds,
    rowCount: filteredData.length,
  });

  const dynamicColumns = useMemo(() => {
    if (!nocoColumns) return [];
    return buildColumns(
      nocoColumns,
      hiddenSet,
      readOnlySet,
      cellEditing,
      onCellUpdate,
      keyboard.activeCell?.rowIndex,
      keyboard.activeCell?.colId,
    );
  }, [
    nocoColumns,
    hiddenSet,
    readOnlySet,
    cellEditing,
    onCellUpdate,
    keyboard.activeCell?.rowIndex,
    keyboard.activeCell?.colId,
  ]);

  // Column metadata for toolbar popovers
  const columnsMeta = useMemo(() => {
    return dynamicColumns.map((col) => ({
      id: col.id as string,
      label:
        (col.meta as { title?: string })?.title ?? (col.id as string),
      uidt: (col.meta as { uidt?: string })?.uidt,
      isPrimary: (col.meta as { isPrimary?: boolean })?.isPrimary,
    }));
  }, [dynamicColumns]);

  // Row number column
  const rowNumberColumn: ColumnDef<Row> = useMemo(
    () => ({
      id: "_rowNum",
      header: () => <span className="text-xs text-muted-foreground">#</span>,
      cell: ({ row }) => (
        <RowNumberCell
          index={row.index + 1}
          onExpand={() => onRowExpand?.(row.original)}
          isSelected={rowSelection[String(row.original.id)] === true}
          onSelect={() => {
            const id = String(row.original.id);
            setRowSelection((prev) => ({
              ...prev,
              [id]: !prev[id],
            }));
          }}
          hasSelection={Object.values(rowSelection).some(Boolean)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
      minSize: 50,
      maxSize: 50,
    }),
    [onRowExpand, rowSelection],
  );

  const allColumns: ColumnDef<Row>[] = useMemo(() => {
    const cols: ColumnDef<Row>[] = [];
    if (onBulkDelete) cols.push(selectColumn);
    cols.push(rowNumberColumn);
    cols.push(...dynamicColumns);
    return cols;
  }, [onBulkDelete, rowNumberColumn, dynamicColumns]);

  // Handle sorting changes — sync to prefs and call external handler
  const handleSortingChange = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      setSorting((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        prefs.setSorting(next);
        onSortChangeProp?.(next);
        return next;
      });
    },
    [prefs, onSortChangeProp],
  );

  // Toolbar sort → TanStack sort
  const handleToolbarSortChange = useCallback(
    (sorts: SortDef[]) => {
      setToolbarSorting(sorts);
      const tanstackSorting: SortingState = sorts.map((s) => ({
        id: s.id,
        desc: s.desc,
      }));
      handleSortingChange(tanstackSorting);
    },
    [handleSortingChange],
  );

  const handleToolbarFilterChange = useCallback(
    (filters: FilterDef[]) => {
      setToolbarFilters(filters);
      onFilterChangeProp?.(filters);
    },
    [onFilterChangeProp],
  );

  // Column visibility changes — persist
  const handleColumnVisibilityChange = useCallback(
    (vis: VisibilityState) => {
      setColumnVisibility(vis);
      prefs.setColumnVisibility(vis);
    },
    [prefs],
  );

  const table = useReactTable({
    data: filteredData,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: handleSortingChange,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onRowSelectionChange: setRowSelection,
    state: { sorting, globalFilter, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize: 50 } },
    enableRowSelection: !!onBulkDelete,
    getRowId: (row) => String(row.id ?? Math.random()),
    columnResizeMode: "onChange",
  });

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();

  // Grid-level keyboard handling
  const wrapperRef = useRef<HTMLDivElement>(null);
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Delegate to keyboard navigation
      keyboard.handleKeyDown(e);

      // Escape from editing
      if (e.key === "Escape") {
        cellEditing.cancelEditing();
      }

      // Enter to start editing active cell
      if (
        e.key === "Enter" &&
        keyboard.activeCell &&
        !keyboard.isEditing
      ) {
        const rowData = data[keyboard.activeCell.rowIndex];
        if (rowData?.id != null) {
          cellEditing.startEditing(
            rowData.id,
            keyboard.activeCell.colId,
          );
          keyboard.startEditing();
        }
      }

      // Spacebar on row number column → expand
      if (
        e.key === " " &&
        cellEditing.selected &&
        !cellEditing.editing &&
        onRowExpand
      ) {
        e.preventDefault();
        const selectedRowId = cellEditing.selected.rowId;
        const row = data.find((r) => r.id === selectedRowId);
        if (row) onRowExpand(row);
      }
    },
    [keyboard, cellEditing, onRowExpand, data],
  );

  // Click on grid to set active cell
  const handleCellClick = useCallback(
    (rowIndex: number, colId: string) => {
      keyboard.setActiveCell({ rowIndex, colId });
    },
    [keyboard],
  );

  const selectedIds = table
    .getSelectedRowModel()
    .rows.map((r) => (r.original as { id?: number }).id)
    .filter((id): id is number => id != null && typeof id === "number");

  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete || selectedIds.length === 0) return;
    await onBulkDelete(selectedIds);
    setRowSelection({});
  }, [onBulkDelete, selectedIds]);

  const loading = isLoading || columnsLoading;

  // Pagination info
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const totalRows = total ?? data.length;
  const displayedRows = filteredData.length;

  const rowHeightPx = ROW_HEIGHT_PX[prefs.rowHeight];

  // Determine sticky column positions
  const hasSelectCol = !!onBulkDelete;
  const selectColWidth = hasSelectCol ? 40 : 0;
  const rowNumWidth = 50;
  const rowNumLeft = selectColWidth;

  // Find the first data column for sticky pinning
  const firstDataColId = dynamicColumns[0]?.id as string | undefined;
  const firstDataColLeft = selectColWidth + rowNumWidth;

  return (
    <div className="flex h-full w-full flex-col">
      <SpreadsheetToolbar
        resource={resource}
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
        searchPlaceholder={searchPlaceholder}
        extra={toolbar}
        columns={columnsMeta}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        columnOrder={prefs.columnOrder}
        onColumnOrderChange={prefs.setColumnOrder}
        sorting={toolbarSorting}
        onSortChange={handleToolbarSortChange}
        filters={toolbarFilters}
        onFilterChange={handleToolbarFilterChange}
        rowHeight={prefs.rowHeight}
        onRowHeightChange={prefs.setRowHeight}
      />

      {onBulkDelete && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 border-b bg-muted/50 px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">
            {selectedIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 text-xs"
            onClick={handleBulkDelete}
          >
            Delete selected
          </Button>
        </div>
      )}

      <div
        ref={wrapperRef}
        tabIndex={0}
        className="flex-1 overflow-auto outline-none"
        onKeyDown={handleGridKeyDown}
      >
        <Table
          className="border-separate border-spacing-0"
          style={{ width: table.getCenterTotalSize() }}
        >
          <TableHeader className="sticky top-0 z-20">
            {headerGroups.map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b-2 bg-muted/50"
              >
                {headerGroup.headers.map((header) => {
                  const isRowNum = header.column.id === "_rowNum";
                  const isSelect = header.column.id === "select";
                  const isFirstData =
                    stickyFirstColumn &&
                    header.column.id === firstDataColId;

                  const stickyClass = cn(
                    (isRowNum || isSelect) &&
                      "sticky z-20 bg-muted/50",
                    isFirstData &&
                      "sticky z-20 bg-muted/50",
                  );
                  const stickyStyle: React.CSSProperties = {};
                  if (isSelect) stickyStyle.left = 0;
                  if (isRowNum) stickyStyle.left = rowNumLeft;
                  if (isFirstData) stickyStyle.left = firstDataColLeft;

                  const isDataColumn =
                    !isRowNum &&
                    !isSelect &&
                    header.column.id !== undefined;

                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "relative border-b-2 border-r border-border bg-muted/50 px-2",
                        stickyClass,
                        (isRowNum || isFirstData) &&
                          "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]",
                      )}
                      style={{
                        width: header.getSize(),
                        height: 32,
                        ...stickyStyle,
                      }}
                    >
                      {header.isPlaceholder ? null : isDataColumn ? (
                        <ColumnHeaderMenu
                          onSortAsc={() => {
                            handleSortingChange([
                              { id: header.column.id, desc: false },
                            ]);
                            setToolbarSorting([
                              { id: header.column.id, desc: false },
                            ]);
                          }}
                          onSortDesc={() => {
                            handleSortingChange([
                              { id: header.column.id, desc: true },
                            ]);
                            setToolbarSorting([
                              { id: header.column.id, desc: true },
                            ]);
                          }}
                          onHide={() => {
                            handleColumnVisibilityChange({
                              ...columnVisibility,
                              [header.column.id]: false,
                            });
                          }}
                        >
                          <div
                            className="flex w-full"
                            onContextMenu={(e) => {
                              // Context menu is handled by DropdownMenu
                            }}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                          </div>
                        </ColumnHeaderMenu>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
                            header.column.getIsResizing()
                              ? "bg-primary"
                              : "hover:bg-primary/50",
                          )}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  {allColumns.map((_, j) => (
                    <TableCell
                      key={j}
                      className="border-b border-r border-border px-2"
                      style={{ height: rowHeightPx }}
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length ? (
              rows.map((row) => {
                const isRowSelected = row.getIsSelected();
                return (
                  <TableRow
                    key={row.id}
                    data-state={isRowSelected && "selected"}
                    className={cn(
                      "group",
                      isRowSelected && "bg-blue-50/50",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isRowNum = cell.column.id === "_rowNum";
                      const isSelect = cell.column.id === "select";
                      const isFirstData =
                        stickyFirstColumn &&
                        cell.column.id === firstDataColId;

                      const stickyClass = cn(
                        (isRowNum || isSelect) &&
                          "sticky z-10 bg-background",
                        isFirstData &&
                          "sticky z-10 bg-background",
                        isRowSelected &&
                          (isRowNum || isSelect || isFirstData) &&
                          "bg-blue-50/50",
                      );
                      const stickyStyle: React.CSSProperties = {};
                      if (isSelect) stickyStyle.left = 0;
                      if (isRowNum) stickyStyle.left = rowNumLeft;
                      if (isFirstData)
                        stickyStyle.left = firstDataColLeft;

                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "border-b border-r border-border p-0",
                            stickyClass,
                            (isRowNum || isFirstData) &&
                              "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]",
                          )}
                          style={{
                            width: cell.column.getSize(),
                            height: rowHeightPx,
                            ...stickyStyle,
                          }}
                          onClick={() => {
                            if (!isRowNum && !isSelect) {
                              handleCellClick(row.index, cell.column.id);
                            }
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {/* New row footer */}
          {onNewRow && !loading && (
            <tfoot className="sticky bottom-0 z-10">
              <tr>
                <td
                  colSpan={allColumns.length}
                  className="border-b border-t bg-background"
                >
                  <button
                    className="flex w-full items-center gap-1.5 px-3 text-sm text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                    style={{ height: rowHeightPx }}
                    onClick={onNewRow}
                  >
                    <Plus className="size-3.5" />
                    New row
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>

      {/* Compact footer */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t bg-muted/20 px-3 text-xs text-muted-foreground">
        <span>
          {toolbarFilters.length > 0
            ? `${displayedRows} of ${totalRows} record${totalRows !== 1 ? "s" : ""}`
            : `${totalRows} record${totalRows !== 1 ? "s" : ""}`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="tabular-nums">
              {pageIndex + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
