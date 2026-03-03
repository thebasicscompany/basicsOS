import * as React from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnResizeMode,
} from "@tanstack/react-table";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";
import type { ViewColumn, ViewSort } from "@/types/views";
import { PlusIcon } from "@phosphor-icons/react";
import { Cell } from "@/components/cells";
import {
  getVisibleAttributes,
  parseWidth,
} from "./utils";

export interface DataTableProps {
  objectSlug: string;
  singularName: string;
  pluralName: string;
  attributes: Attribute[];
  data: Record<string, unknown>[];
  total: number;
  isLoading: boolean;
  viewColumns: ViewColumn[];
  onCellUpdate: (recordId: number, columnName: string, value: unknown) => void;
  onRowExpand?: (recordId: number) => void;
  onNewRecord?: () => void;
  onAddColumn?: () => void;
  onColumnResize?: (fieldId: string, width: number) => void;
  onColumnReorder?: (fieldId: string, newOrder: number) => void;
  pagination: { page: number; perPage: number };
  onPaginationChange: (page: number, perPage: number) => void;
  sorts?: ViewSort[];
  filters?: unknown[];
}

export interface CellPosition {
  rowIndex: number;
  colId: string;
}

export function useDataTable(props: DataTableProps) {
  const {
    singularName,
    pluralName,
    attributes,
    data,
    total,
    viewColumns,
    onCellUpdate,
    onRowExpand,
    onNewRecord,
    onAddColumn,
    onColumnResize,
    onColumnReorder,
    pagination,
    onPaginationChange,
  } = props;

  const [selectedCell, setSelectedCell] = React.useState<CellPosition | null>(
    null,
  );
  const [editingCell, setEditingCell] = React.useState<CellPosition | null>(
    null,
  );

  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(
    () => {
      const widths: Record<string, number> = {};
      for (const vc of viewColumns) {
        if (vc.width != null && vc.width !== "") {
          widths[vc.fieldId] = parseWidth(vc.width);
        }
      }
      return widths;
    },
  );

  React.useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      for (const vc of viewColumns) {
        if (vc.width != null && vc.width !== "" && !(vc.fieldId in next)) {
          next[vc.fieldId] = parseWidth(vc.width);
        }
      }
      return next;
    });
  }, [viewColumns]);

  const tableRef = React.useRef<HTMLDivElement>(null);
  const selectedCellRef = React.useRef(selectedCell);
  selectedCellRef.current = selectedCell;
  const editingCellRef = React.useRef(editingCell);
  editingCellRef.current = editingCell;

  const { visible: visibleCols, hiddenEmptyCount } = React.useMemo(
    () => getVisibleAttributes(attributes, viewColumns, data),
    [attributes, viewColumns, data],
  );

  const sortableColumnIds = React.useMemo(
    () => visibleCols.map((c) => c.attribute.id),
    [visibleCols],
  );

  const columns = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols: ColumnDef<Record<string, unknown>>[] = [];

    for (const { attribute, viewColumn } of visibleCols) {
      const fieldType = getFieldType(attribute.uiType);
      const hasExplicitWidth =
        (columnWidths[attribute.id] ?? 0) > 0 ||
        (viewColumn.width != null && viewColumn.width !== "");
      const colWidth = hasExplicitWidth
        ? (columnWidths[attribute.id] ?? parseWidth(viewColumn.width))
        : 1;

      cols.push({
        id: attribute.id,
        accessorFn: (row) => row[attribute.columnName],
        size: colWidth,
        minSize: hasExplicitWidth ? 60 : 1,
        enableResizing: true,
        meta: { fitContent: !hasExplicitWidth } as Record<string, unknown>,
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
            selectedCellRef.current?.rowIndex === rowIndex &&
            selectedCellRef.current?.colId === colId;
          const isEdit =
            editingCellRef.current?.rowIndex === rowIndex &&
            editingCellRef.current?.colId === colId;

          return (
            <Cell
              attribute={attribute}
              value={row.original[attribute.columnName]}
              isSelected={isSel}
              isEditing={isEdit}
              onStartEditing={() => setEditingCell({ rowIndex, colId })}
              onSave={(newVal) => {
                onCellUpdate(
                  (row.original.Id ?? row.original.id) as number,
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

    if (hiddenEmptyCount > 0) {
      cols.push({
        id: "_emptyColsIndicator",
        size: 100,
        minSize: 60,
        enableResizing: false,
        header: () => (
          <span className="text-xs text-muted-foreground">
            +{hiddenEmptyCount} empty {hiddenEmptyCount === 1 ? "column" : "columns"}
          </span>
        ),
        cell: () => null,
      });
    }

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
            <PlusIcon className="size-4" />
          </button>
        ) : null,
      cell: () => null,
    });

    return cols;
  }, [visibleCols, hiddenEmptyCount, columnWidths, onCellUpdate, onAddColumn]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange" as ColumnResizeMode,
    getRowId: (row) => String((row as { Id?: number; id?: number }).Id ?? (row as { id?: number }).id ?? Math.random()),
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.perPage),
  });

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell) return;

      const { rowIndex, colId } = selectedCell;
      const dataColIds = visibleCols.map((c) => c.attribute.id);
      const colIdx = dataColIds.indexOf(colId);
      const rowCount = data.length;

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
          if (rowIndex > 0) setSelectedCell({ rowIndex: rowIndex - 1, colId });
          break;
        case "ArrowDown":
          e.preventDefault();
          if (rowIndex < rowCount - 1)
            setSelectedCell({ rowIndex: rowIndex + 1, colId });
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (colIdx > 0)
            setSelectedCell({ rowIndex, colId: dataColIds[colIdx - 1] });
          break;
        case "ArrowRight":
        case "Tab":
          e.preventDefault();
          if (colIdx < dataColIds.length - 1) {
            setSelectedCell({ rowIndex, colId: dataColIds[colIdx + 1] });
          } else if (rowIndex < rowCount - 1) {
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

  const handleCellClick = React.useCallback(
    (rowIndex: number, colId: string, attribute: Attribute) => {
      if (attribute.uiType === "Checkbox") return;

      if (selectedCell?.rowIndex === rowIndex && selectedCell?.colId === colId) {
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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
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

  const totalPages = Math.max(1, Math.ceil(total / pagination.perPage));

  return {
    table,
    columns,
    visibleCols,
    sortableColumnIds,
    selectedCell,
    tableRef,
    handleKeyDown,
    handleCellClick,
    handleCellDoubleClick,
    sensors,
    handleDragEnd,
    handleColumnResize,
    totalPages,
    total,
    singularName,
    pluralName,
    pagination,
    onPaginationChange,
    onRowExpand,
    onNewRecord,
  };
}
