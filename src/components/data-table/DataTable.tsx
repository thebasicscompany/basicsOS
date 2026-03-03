import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnResizeMode,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Cell } from "@/components/cells";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";
import type { ViewColumn, ViewSort, ViewFilter } from "@/types/views";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Expand,
  GripVertical,
  Plus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableProps {
  objectSlug: string;
  singularName: string;
  pluralName: string;
  attributes: Attribute[];
  data: Record<string, any>[];
  total: number;
  isLoading: boolean;
  viewColumns: ViewColumn[];
  onCellUpdate: (recordId: number, columnName: string, value: any) => void;
  onRowDelete?: (recordIds: number[]) => void;
  onRowExpand?: (recordId: number) => void;
  onNewRecord?: () => void;
  onAddColumn?: () => void;
  onColumnResize?: (fieldId: string, width: number) => void;
  onColumnReorder?: (fieldId: string, newOrder: number) => void;
  pagination: { page: number; perPage: number };
  onPaginationChange: (page: number, perPage: number) => void;
  sorts?: ViewSort[];
  filters?: ViewFilter[];
}

interface CellPosition {
  rowIndex: number;
  colId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVisibleAttributes(
  attributes: Attribute[],
  viewColumns: ViewColumn[],
): Array<{ attribute: Attribute; viewColumn: ViewColumn }> {
  const attrMap = new Map(attributes.map((a) => [a.id, a]));
  return viewColumns
    .filter((vc) => vc.show)
    .sort((a, b) => a.order - b.order)
    .map((vc) => {
      const attribute = attrMap.get(vc.fieldId);
      if (!attribute) return null;
      return { attribute, viewColumn: vc };
    })
    .filter(Boolean) as Array<{ attribute: Attribute; viewColumn: ViewColumn }>;
}

function parseWidth(width: string | undefined): number {
  if (!width) return 150;
  const n = parseInt(width, 10);
  return Number.isNaN(n) ? 150 : n;
}

// ---------------------------------------------------------------------------
// Sortable Header Cell
// ---------------------------------------------------------------------------

function SortableHeaderCell({
  id,
  children,
  style,
  className,
  ...rest
}: React.ComponentProps<"th"> & { id: string }) {
  const {
    attributes: dndAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const mergedStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={mergedStyle}
      className={cn(className, "relative select-none")}
      {...rest}
    >
      <div className="flex items-center gap-1">
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground shrink-0"
          {...dndAttributes}
          {...listeners}
        >
          <GripVertical className="size-3" />
        </button>
        {children}
      </div>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// Column Resize Handle
// ---------------------------------------------------------------------------

function ColumnResizeHandle({
  onResize,
}: {
  onResize: (delta: number) => void;
}) {
  const startX = React.useRef(0);
  const isDragging = React.useRef(false);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      isDragging.current = true;

      const handleMouseMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = me.clientX - startX.current;
        startX.current = me.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize],
  );

  return (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none hover:bg-primary/30 active:bg-primary/50 z-10"
      onMouseDown={handleMouseDown}
    />
  );
}

// ---------------------------------------------------------------------------
// DataTable Component
// ---------------------------------------------------------------------------

export function DataTable({
  objectSlug,
  singularName,
  pluralName,
  attributes,
  data,
  total,
  isLoading,
  viewColumns,
  onCellUpdate,
  onRowDelete,
  onRowExpand,
  onNewRecord,
  onAddColumn,
  onColumnResize,
  onColumnReorder,
  pagination,
  onPaginationChange,
  sorts,
  filters,
}: DataTableProps) {
  // ---- Selection & editing state ----
  const [selectedCell, setSelectedCell] = React.useState<CellPosition | null>(
    null,
  );
  const [editingCell, setEditingCell] = React.useState<CellPosition | null>(
    null,
  );
  const [rowSelection, setRowSelection] = React.useState<
    Record<string, boolean>
  >({});

  // ---- Column widths (local override) ----
  const [columnWidths, setColumnWidths] = React.useState<
    Record<string, number>
  >(() => {
    const widths: Record<string, number> = {};
    for (const vc of viewColumns) {
      widths[vc.fieldId] = parseWidth(vc.width);
    }
    return widths;
  });

  // Sync when viewColumns change externally
  React.useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const vc of viewColumns) {
        if (!(vc.fieldId in next)) {
          next[vc.fieldId] = parseWidth(vc.width);
        }
      }
      return next;
    });
  }, [viewColumns]);

  const tableRef = React.useRef<HTMLDivElement>(null);

  // ---- Derived visible columns ----
  const visibleCols = React.useMemo(
    () => getVisibleAttributes(attributes, viewColumns),
    [attributes, viewColumns],
  );

  // Column IDs for dnd-kit sortable context
  const sortableColumnIds = React.useMemo(
    () => visibleCols.map((c) => c.attribute.id),
    [visibleCols],
  );

  // ---- Build TanStack columns ----
  const columns = React.useMemo<ColumnDef<Record<string, any>>[]>(() => {
    const cols: ColumnDef<Record<string, any>>[] = [];

    // 1. Row selection checkbox column
    cols.push({
      id: "_select",
      size: 40,
      minSize: 40,
      maxSize: 40,
      enableResizing: false,
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
    });

    // 2. Row number / expand column
    cols.push({
      id: "_rowNum",
      size: 48,
      minSize: 48,
      maxSize: 48,
      enableResizing: false,
      header: () => <span className="text-muted-foreground">#</span>,
      cell: ({ row }) => (
        <div className="group/rownum flex items-center justify-center gap-0.5 text-muted-foreground text-xs">
          <span className={cn(onRowExpand && "group-hover/rownum:hidden")}>
            {pagination.perPage * (pagination.page - 1) + row.index + 1}
          </span>
          {onRowExpand && (
            <button
              className="hidden group-hover/rownum:flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onRowExpand(row.original.Id ?? row.original.id);
              }}
            >
              <Expand className="size-3.5" />
            </button>
          )}
        </div>
      ),
    });

    // 3. Data columns from attributes
    for (const { attribute, viewColumn } of visibleCols) {
      const fieldType = getFieldType(attribute.uiType);
      const colWidth =
        columnWidths[attribute.id] ?? parseWidth(viewColumn.width);

      cols.push({
        id: attribute.id,
        accessorFn: (row) => row[attribute.columnName],
        size: colWidth,
        minSize: 60,
        enableResizing: true,
        header: () => (
          <div className="flex items-center gap-1.5 text-xs font-medium truncate">
            <span className="text-muted-foreground">
              {attribute.icon ?? (fieldType.icon ? <fieldType.icon className="size-3.5" /> : null)}
            </span>
            <span className="truncate">
              {viewColumn.title || attribute.name}
            </span>
          </div>
        ),
        cell: ({ row, column }) => {
          const rowIndex = row.index;
          const colId = column.id;
          const isSel =
            selectedCell?.rowIndex === rowIndex &&
            selectedCell?.colId === colId;
          const isEdit =
            editingCell?.rowIndex === rowIndex && editingCell?.colId === colId;

          return (
            <Cell
              attribute={attribute}
              value={row.original[attribute.columnName]}
              isSelected={isSel}
              isEditing={isEdit}
              onStartEditing={() => setEditingCell({ rowIndex, colId })}
              onSave={(newVal) => {
                onCellUpdate(
                  row.original.Id ?? row.original.id,
                  attribute.columnName,
                  newVal,
                );
                setEditingCell(null);
              }}
              onCancel={() => setEditingCell(null)}
            />
          );
        },
      });
    }

    // 4. Add column button
    cols.push({
      id: "_addColumn",
      size: 40,
      minSize: 40,
      maxSize: 40,
      enableResizing: false,
      header: () =>
        onAddColumn ? (
          <button
            className="flex items-center justify-center w-full h-full text-muted-foreground hover:text-foreground"
            onClick={onAddColumn}
          >
            <Plus className="size-4" />
          </button>
        ) : null,
      cell: () => null,
    });

    return cols;
  }, [
    visibleCols,
    columnWidths,
    selectedCell,
    editingCell,
    pagination,
    onRowExpand,
    onCellUpdate,
    onAddColumn,
  ]);

  // ---- TanStack Table instance ----
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange" as ColumnResizeMode,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
    getRowId: (row) => String(row.Id ?? row.id ?? Math.random()),
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.perPage),
  });

  // ---- Keyboard navigation ----
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell) return;

      const { rowIndex, colId } = selectedCell;
      const dataColIds = visibleCols.map((c) => c.attribute.id);
      const colIdx = dataColIds.indexOf(colId);
      const rowCount = data.length;

      // If we're editing, only handle Escape
      if (editingCell) {
        if (e.key === "Escape") {
          e.preventDefault();
          setEditingCell(null);
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (rowIndex > 0) {
            setSelectedCell({ rowIndex: rowIndex - 1, colId });
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (rowIndex < rowCount - 1) {
            setSelectedCell({ rowIndex: rowIndex + 1, colId });
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (colIdx > 0) {
            setSelectedCell({ rowIndex, colId: dataColIds[colIdx - 1] });
          }
          break;
        case "ArrowRight":
        case "Tab":
          e.preventDefault();
          if (colIdx < dataColIds.length - 1) {
            setSelectedCell({ rowIndex, colId: dataColIds[colIdx + 1] });
          } else if (rowIndex < rowCount - 1) {
            // Wrap to next row
            setSelectedCell({
              rowIndex: rowIndex + 1,
              colId: dataColIds[0],
            });
          }
          break;
        case "Enter":
          e.preventDefault();
          setEditingCell({ rowIndex, colId });
          break;
        case "Escape":
          e.preventDefault();
          setSelectedCell(null);
          break;
      }
    },
    [selectedCell, editingCell, visibleCols, data.length],
  );

  // Click outside table to deselect
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSelectedCell(null);
        setEditingCell(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ---- Cell click handlers ----
  const handleCellClick = React.useCallback(
    (rowIndex: number, colId: string, attribute: Attribute) => {
      // Checkbox fields toggle on single click
      if (attribute.uiType === "Checkbox") {
        return; // Cell component handles it directly
      }

      if (
        selectedCell?.rowIndex === rowIndex &&
        selectedCell?.colId === colId
      ) {
        // Already selected, enter edit mode
        setEditingCell({ rowIndex, colId });
      } else {
        setSelectedCell({ rowIndex, colId });
        setEditingCell(null);
      }
    },
    [selectedCell],
  );

  const handleCellDoubleClick = React.useCallback(
    (rowIndex: number, colId: string) => {
      setSelectedCell({ rowIndex, colId });
      setEditingCell({ rowIndex, colId });
    },
    [],
  );

  // ---- Column reorder via dnd-kit ----
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onColumnReorder) return;

      const oldIndex = sortableColumnIds.indexOf(String(active.id));
      const newIndex = sortableColumnIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      onColumnReorder(String(active.id), newIndex);
    },
    [sortableColumnIds, onColumnReorder],
  );

  // ---- Column resize handler ----
  const handleColumnResize = React.useCallback(
    (fieldId: string, delta: number) => {
      setColumnWidths((prev) => {
        const current = prev[fieldId] ?? 150;
        const newWidth = Math.max(60, current + delta);
        return { ...prev, [fieldId]: newWidth };
      });
      onColumnResize?.(fieldId, (columnWidths[fieldId] ?? 150) + delta);
    },
    [onColumnResize, columnWidths],
  );

  // ---- Pagination helpers ----
  const totalPages = Math.max(1, Math.ceil(total / pagination.perPage));
  const canPrevPage = pagination.page > 1;
  const canNextPage = pagination.page < totalPages;

  // ---- Bulk selection ----
  const selectedRowIds = Object.keys(rowSelection).filter(
    (k) => rowSelection[k],
  );

  // ---- Render ----
  return (
    <div className="flex min-w-0 w-full flex-col">
      {/* Bulk actions bar */}
      {selectedRowIds.length > 0 && onRowDelete && (
        <div className="flex items-center gap-3 rounded-t-md border border-b-0 bg-muted/50 px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">
            {selectedRowIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="xs"
            onClick={() => onRowDelete(selectedRowIds.map((id) => Number(id)))}
          >
            Delete
          </Button>
        </div>
      )}

      {/* Scrollable table area */}
      <div
        ref={tableRef}
        tabIndex={0}
        className={cn(
          "overflow-auto border outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selectedRowIds.length > 0 && onRowDelete
            ? "rounded-b-md"
            : "rounded-md",
        )}
        onKeyDown={handleKeyDown}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
          <Table style={{ width: "max-content", minWidth: "100%" }}>
            {/* ---- Header ---- */}
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  <SortableContext
                    items={sortableColumnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => {
                      const isSortable = sortableColumnIds.includes(header.id);
                      const isSticky =
                        header.id === "_select" || header.id === "_rowNum";
                      const isPrimaryAttr =
                        visibleCols.length > 0 &&
                        header.id === visibleCols[0].attribute.id;

                      const stickyStyle: React.CSSProperties = {};
                      if (isSticky || isPrimaryAttr) {
                        if (header.id === "_select") {
                          stickyStyle.position = "sticky";
                          stickyStyle.left = 0;
                          stickyStyle.zIndex = 3;
                        } else if (header.id === "_rowNum") {
                          stickyStyle.position = "sticky";
                          stickyStyle.left = 40;
                          stickyStyle.zIndex = 3;
                        } else if (isPrimaryAttr) {
                          stickyStyle.position = "sticky";
                          stickyStyle.left = 88; // 40 + 48
                          stickyStyle.zIndex = 3;
                        }
                      }

                      if (isSortable) {
                        return (
                          <SortableHeaderCell
                            key={header.id}
                            id={header.id}
                            colSpan={header.colSpan}
                            style={{
                              width: header.getSize(),
                              minWidth: header.column.columnDef.minSize,
                              maxWidth: header.column.columnDef.maxSize,
                              ...stickyStyle,
                            }}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                            {header.column.getCanResize() && (
                              <ColumnResizeHandle
                                onResize={(delta) =>
                                  handleColumnResize(header.id, delta)
                                }
                              />
                            )}
                          </SortableHeaderCell>
                        );
                      }

                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          style={{
                            width: header.getSize(),
                            minWidth: header.column.columnDef.minSize,
                            maxWidth: header.column.columnDef.maxSize,
                            ...stickyStyle,
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>

            {/* ---- Body ---- */}
            <TableBody>
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: Math.min(pagination.perPage, 10) }).map(
                  (_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ),
                )
              ) : data.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <p className="text-sm">
                        No {pluralName.toLowerCase()} found
                      </p>
                      {onNewRecord && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onNewRecord}
                        >
                          <Plus className="size-3.5 mr-1" />
                          New {singularName}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                // Data rows
                table.getRowModel().rows.map((row) => {
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const colDef = cell.column.columnDef;
                        const colId = cell.column.id;
                        const rowIndex = row.index;

                        const isSticky =
                          colId === "_select" || colId === "_rowNum";
                        const isPrimaryAttr =
                          visibleCols.length > 0 &&
                          colId === visibleCols[0].attribute.id;

                        const stickyStyle: React.CSSProperties = {};
                        if (isSticky || isPrimaryAttr) {
                          if (colId === "_select") {
                            stickyStyle.position = "sticky";
                            stickyStyle.left = 0;
                            stickyStyle.zIndex = 2;
                          } else if (colId === "_rowNum") {
                            stickyStyle.position = "sticky";
                            stickyStyle.left = 40;
                            stickyStyle.zIndex = 2;
                          } else if (isPrimaryAttr) {
                            stickyStyle.position = "sticky";
                            stickyStyle.left = 88;
                            stickyStyle.zIndex = 2;
                          }
                        }

                        const isSel =
                          selectedCell?.rowIndex === rowIndex &&
                          selectedCell?.colId === colId;

                        // Find the attribute for this column
                        const matchedCol = visibleCols.find(
                          (c) => c.attribute.id === colId,
                        );

                        return (
                          <TableCell
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              minWidth: colDef.minSize,
                              maxWidth: colDef.maxSize,
                              ...stickyStyle,
                            }}
                            className={cn(
                              (isSticky || isPrimaryAttr) && "bg-background",
                              isSel &&
                                "ring-2 ring-inset ring-primary/50 bg-primary/5",
                            )}
                            onClick={() => {
                              if (matchedCol) {
                                handleCellClick(
                                  rowIndex,
                                  colId,
                                  matchedCol.attribute,
                                );
                              }
                            }}
                            onDoubleClick={() => {
                              if (matchedCol) {
                                handleCellDoubleClick(rowIndex, colId);
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
              )}

              {/* ---- Inline add row ---- */}
              {onNewRecord && !isLoading && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-8 text-muted-foreground"
                  >
                    <button
                      className="flex items-center gap-1.5 text-xs hover:text-foreground transition-colors"
                      onClick={onNewRecord}
                    >
                      <Plus className="size-3.5" />
                      New {singularName}
                    </button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {/* ---- Pagination ---- */}
      <div className="flex items-center justify-between gap-4 px-1 py-2 text-sm">
        <div className="text-muted-foreground whitespace-nowrap text-xs">
          {total}{" "}
          {total === 1 ? singularName.toLowerCase() : pluralName.toLowerCase()}
          {selectedRowIds.length > 0 && (
            <span className="ml-1">({selectedRowIds.length} selected)</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Rows per page
            </span>
            <Select
              value={String(pagination.perPage)}
              onValueChange={(v) => onPaginationChange(1, Number(v))}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[25, 50, 100, 200].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page indicator */}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Page {pagination.page} of {totalPages}
          </span>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              aria-label="Go to first page"
              variant="outline"
              size="icon-xs"
              onClick={() => onPaginationChange(1, pagination.perPage)}
              disabled={!canPrevPage}
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              aria-label="Go to previous page"
              variant="outline"
              size="icon-xs"
              onClick={() =>
                onPaginationChange(pagination.page - 1, pagination.perPage)
              }
              disabled={!canPrevPage}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              aria-label="Go to next page"
              variant="outline"
              size="icon-xs"
              onClick={() =>
                onPaginationChange(pagination.page + 1, pagination.perPage)
              }
              disabled={!canNextPage}
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              aria-label="Go to last page"
              variant="outline"
              size="icon-xs"
              onClick={() => onPaginationChange(totalPages, pagination.perPage)}
              disabled={!canNextPage}
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
