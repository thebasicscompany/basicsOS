import * as React from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnResizeMode,
} from "@tanstack/react-table";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";
import { getRecordValue } from "@/lib/crm/field-mapper";
import {
  getNameAttributes,
  getRecordDisplayName,
  shouldHideSplitNameAttribute,
} from "@/lib/crm/display-name";
import type { ViewColumn, ViewSort } from "@/types/views";
import { PlusIcon } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Cell } from "@/components/cells";
import { getVisibleAttributes, parseWidth } from "./utils";
import {
  DataTableSelectAllHeader,
  DataTableRowSelectCell,
  DATA_TABLE_SELECT_COL_WIDTH,
  DATA_TABLE_ROW_SELECT_COLUMN_ID,
} from "./DataTableRowSelectCells";

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
  onRowDelete?: (recordId: number, record: Record<string, unknown>) => void;
  extraContextMenuItems?: (record: Record<string, unknown>) => React.ReactNode;
  onNewRecord?: () => void;
  onAddColumn?: () => void;
  onColumnResize?: (fieldId: string, width: number) => void;
  onSwapColumns?: (fieldIdA: string, fieldIdB: string) => void;
  onAddSort?: (fieldId: string, direction: "asc" | "desc") => void;
  onHideColumn?: (fieldId: string) => void;
  onShowColumn?: (fieldId: string) => void;
  onRenameColumn?: (fieldId: string, title: string) => void;
  onEditAttribute?: (fieldId: string) => void;
  /** delete a custom field (passed `custom_<id>`); only wired for custom fields */
  onDeleteColumn?: (fieldId: string) => void;
  pagination: { page: number; perPage: number };
  onPaginationChange: (page: number, perPage: number) => void;
  sorts?: ViewSort[];
  filters?: unknown[];
  /** Checkbox column, shift/Cmd-click, drag across rows to select */
  enableRowMultiSelect?: boolean;
  onBulkDeleteRequest?: (recordIds: number[]) => void;
  /** Increment (e.g. after bulk delete) to clear row selection */
  selectionClearKey?: number;
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
    onSwapColumns,
    onAddSort,
    onHideColumn,
    onShowColumn,
    onRenameColumn,
    pagination,
    onPaginationChange,
    enableRowMultiSelect = false,
    selectionClearKey = 0,
  } = props;

  const [selectedCell, setSelectedCell] = React.useState<CellPosition | null>(
    null,
  );
  const [editingCell, setEditingCell] = React.useState<CellPosition | null>(
    null,
  );

  const [selectedRecordIds, setSelectedRecordIds] = React.useState<number[]>(
    [],
  );

  const [columnWidths, setColumnWidths] = React.useState<
    Record<string, number>
  >(() => {
    const widths: Record<string, number> = {};
    for (const vc of viewColumns) {
      if (vc.width != null && vc.width !== "") {
        widths[vc.fieldId] = parseWidth(vc.width);
      }
    }
    return widths;
  });

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

  const selectionAnchorRef = React.useRef<number | null>(null);
  const dragAnchorRef = React.useRef<number | null>(null);
  const dragEndRowRef = React.useRef<number | null>(null);
  const selectDragMovedRef = React.useRef(false);
  const preDragSelectionRef = React.useRef<Set<number>>(new Set());
  const dragIsSelectingRef = React.useRef<boolean>(true);
  const prevSelectionClearKey = React.useRef(selectionClearKey);

  const getRecordId = React.useCallback((row: Record<string, unknown>) => {
    const raw = row.Id ?? row.id;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, []);

  const pageRecordIds = React.useMemo(
    () => data.map((row) => getRecordId(row)).filter((id) => id > 0),
    [data, getRecordId],
  );

  const selectedIdSet = React.useMemo(
    () => new Set(selectedRecordIds),
    [selectedRecordIds],
  );

  const selectedCountOnPage = React.useMemo(
    () => pageRecordIds.filter((id) => selectedIdSet.has(id)).length,
    [pageRecordIds, selectedIdSet],
  );

  const clearRowSelection = React.useCallback(() => {
    setSelectedRecordIds([]);
    selectionAnchorRef.current = null;
    dragAnchorRef.current = null;
    dragEndRowRef.current = null;
  }, []);

  React.useEffect(() => {
    clearRowSelection();
  }, [
    props.objectSlug,
    pagination.page,
    pagination.perPage,
    clearRowSelection,
  ]);

  React.useEffect(() => {
    if (prevSelectionClearKey.current !== selectionClearKey) {
      prevSelectionClearKey.current = selectionClearKey;
      clearRowSelection();
    }
  }, [selectionClearKey, clearRowSelection]);

  const selectAllOnPage = React.useCallback(() => {
    setSelectedRecordIds([...pageRecordIds]);
    selectionAnchorRef.current =
      data.length > 0 ? Math.max(0, data.length - 1) : null;
  }, [pageRecordIds, data.length]);

  const beginDragSelect = React.useCallback(
    (rowIndex: number) => {
      const id = getRecordId(data[rowIndex] ?? {});
      if (!id) return;
      dragAnchorRef.current = rowIndex;
      dragEndRowRef.current = rowIndex;
      selectionAnchorRef.current = rowIndex;

      setSelectedRecordIds((prev) => {
        preDragSelectionRef.current = new Set(prev);
        const isSelected = preDragSelectionRef.current.has(id);
        dragIsSelectingRef.current = !isSelected;

        const next = new Set(prev);
        if (isSelected) next.delete(id);
        else next.add(id);
        return Array.from(next);
      });
    },
    [data, getRecordId],
  );

  const dragSelectToRow = React.useCallback(
    (rowIndex: number) => {
      const anchor = dragAnchorRef.current;
      if (anchor == null) return;
      dragEndRowRef.current = rowIndex;
      const lo = Math.min(anchor, rowIndex);
      const hi = Math.max(anchor, rowIndex);

      const next = new Set(preDragSelectionRef.current);
      for (let i = lo; i <= hi; i++) {
        const id = getRecordId(data[i] ?? {});
        if (id) {
          if (dragIsSelectingRef.current) next.add(id);
          else next.delete(id);
        }
      }
      setSelectedRecordIds(Array.from(next));
    },
    [data, getRecordId],
  );

  const endDragSelect = React.useCallback(() => {
    const start = dragAnchorRef.current;
    const end = dragEndRowRef.current;
    if (start != null && end != null) {
      selectionAnchorRef.current = end;
    } else if (start != null) {
      selectionAnchorRef.current = start;
    }
    dragAnchorRef.current = null;
    dragEndRowRef.current = null;
  }, []);

  const handleShiftSelectRow = React.useCallback(
    (rowIndex: number) => {
      const anchor = selectionAnchorRef.current;
      if (anchor == null) {
        selectionAnchorRef.current = rowIndex;
        const id = getRecordId(data[rowIndex] ?? {});
        if (id) {
          setSelectedRecordIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return Array.from(next);
          });
        }
        return;
      }
      const lo = Math.min(anchor, rowIndex);
      const hi = Math.max(anchor, rowIndex);
      
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) {
          const id = getRecordId(data[i] ?? {});
          if (id) next.add(id);
        }
        return Array.from(next);
      });
    },
    [data, getRecordId],
  );

  const handleCtrlToggleRow = React.useCallback(
    (rowIndex: number) => {
      const id = getRecordId(data[rowIndex] ?? {});
      if (!id) return;
      selectionAnchorRef.current = rowIndex;
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return Array.from(next);
      });
    },
    [getRecordId, data],
  );

  const { visible: visibleCols, hiddenEmptyCount } = React.useMemo(
    () => getVisibleAttributes(attributes, viewColumns, data),
    [attributes, viewColumns, data],
  );

  const hiddenColumns = React.useMemo(() => {
    const visibleFieldIds = new Set(visibleCols.map((c) => c.attribute.id));
    return attributes.filter(
      (a) =>
        !a.isSystem &&
        a.columnName !== "organization_id" &&
        a.columnName !== "Id" &&
        !visibleFieldIds.has(a.id) &&
        !shouldHideSplitNameAttribute(a, attributes),
    );
  }, [attributes, visibleCols]);

  const { firstNameAttr, usesSplitName } = React.useMemo(
    () => getNameAttributes(attributes),
    [attributes],
  );

  const sortableColumnIds = React.useMemo(
    () => visibleCols.map((c) => c.attribute.id),
    [visibleCols],
  );

  const columns = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols: ColumnDef<Record<string, unknown>>[] = [];

    if (enableRowMultiSelect) {
      cols.push({
        id: DATA_TABLE_ROW_SELECT_COLUMN_ID,
        size: DATA_TABLE_SELECT_COL_WIDTH,
        minSize: DATA_TABLE_SELECT_COL_WIDTH,
        maxSize: DATA_TABLE_SELECT_COL_WIDTH,
        enableResizing: false,
        header: () => (
          <DataTableSelectAllHeader
            pageRecordIds={pageRecordIds}
            selectedCountOnPage={selectedCountOnPage}
            onSelectAllOnPage={selectAllOnPage}
            onClearSelection={clearRowSelection}
          />
        ),
        cell: ({ row }) => {
          const rowIndex = row.index;
          const recordId = getRecordId(row.original);
          return (
            <DataTableRowSelectCell
              rowIndex={rowIndex}
              isSelected={recordId > 0 && selectedIdSet.has(recordId)}
              onShiftClick={() => handleShiftSelectRow(rowIndex)}
              onCtrlToggle={() => handleCtrlToggleRow(rowIndex)}
              beginDragSelect={beginDragSelect}
              dragSelectToRow={dragSelectToRow}
              endDragSelect={endDragSelect}
              dragMovedRef={selectDragMovedRef}
            />
          );
        },
      });
    }

    for (const { attribute, viewColumn } of visibleCols) {
      const fieldType = getFieldType(attribute.uiType);
      const isCombinedNameColumn =
        usesSplitName &&
        firstNameAttr != null &&
        attribute.columnName === firstNameAttr.columnName;
      const hasExplicitWidth =
        (columnWidths[attribute.id] ?? 0) > 0 ||
        (viewColumn.width != null && viewColumn.width !== "");
      const colWidth = hasExplicitWidth
        ? (columnWidths[attribute.id] ?? parseWidth(viewColumn.width))
        : 1;

      cols.push({
        id: attribute.id,
        accessorFn: (row) =>
          isCombinedNameColumn
            ? getRecordDisplayName(row, attributes)
            : getRecordValue(row, attribute.columnName),
        size: colWidth,
        minSize: hasExplicitWidth ? 60 : 1,
        enableResizing: true,
        meta: { fitContent: !hasExplicitWidth } as Record<string, unknown>,
        header: () => {
          const displayName = isCombinedNameColumn
            ? "Name"
            : attribute.isPrimary
              ? singularName
              : attribute.name || viewColumn.title;
          const HeaderIcon = fieldType.icon;
          return (
            <div className="flex items-center gap-1.5 text-xs font-medium truncate">
              <span className="text-muted-foreground">
                {HeaderIcon ? <HeaderIcon className="size-3.5" /> : null}
              </span>
              <span className="truncate">{displayName}</span>
            </div>
          );
        },
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
              value={
                isCombinedNameColumn
                  ? getRecordDisplayName(row.original, attributes)
                  : getRecordValue(row.original, attribute.columnName)
              }
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
            +{hiddenEmptyCount} empty{" "}
            {hiddenEmptyCount === 1 ? "column" : "columns"}
          </span>
        ),
        cell: () => null,
      });
    }

    const hasColumnActions = onAddColumn || onShowColumn;
    if (hasColumnActions) {
      cols.push({
        id: "_addColumn",
        size: 120,
        minSize: 80,
        enableResizing: false,
        meta: { fitContent: true } as Record<string, unknown>,
        header: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 w-full h-full text-muted-foreground hover:text-foreground text-xs">
                <PlusIcon className="size-3.5" />
                <span>Add column</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 max-h-64 overflow-y-auto"
            >
              {hiddenColumns.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                    Show column
                  </div>
                  {hiddenColumns.map((attr) => (
                    <DropdownMenuItem
                      key={attr.id}
                      onSelect={() => onShowColumn?.(attr.id)}
                    >
                      {attr.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {hiddenColumns.length > 0 && onAddColumn && (
                <DropdownMenuSeparator />
              )}
              {onAddColumn && (
                <DropdownMenuItem onSelect={onAddColumn}>
                  <PlusIcon className="size-3.5 mr-2" />
                  Create new field
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        cell: () => null,
      });
    }

    return cols;
  }, [
    visibleCols,
    hiddenEmptyCount,
    hiddenColumns,
    columnWidths,
    onCellUpdate,
    onAddColumn,
    onShowColumn,
    singularName,
    attributes,
    firstNameAttr,
    usesSplitName,
    enableRowMultiSelect,
    pageRecordIds,
    selectedCountOnPage,
    selectAllOnPage,
    clearRowSelection,
    getRecordId,
    selectedIdSet,
    handleShiftSelectRow,
    handleCtrlToggleRow,
    beginDragSelect,
    dragSelectToRow,
    endDragSelect,
  ]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange" as ColumnResizeMode,
    getRowId: (row) =>
      String(
        (row as { Id?: number; id?: number }).Id ??
          (row as { id?: number }).id ??
          Math.random(),
      ),
    manualPagination: true,
    pageCount: Math.ceil(total / pagination.perPage),
  });

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (
        enableRowMultiSelect &&
        e.key === "Escape" &&
        selectedRecordIds.length > 0
      ) {
        e.preventDefault();
        clearRowSelection();
        return;
      }

      if (
        enableRowMultiSelect &&
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "a"
      ) {
        const t = e.target as HTMLElement;
        if (!t.closest("input,textarea,[contenteditable=true]")) {
          e.preventDefault();
          selectAllOnPage();
          return;
        }
      }

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
    [
      selectedCell,
      editingCell,
      visibleCols,
      data.length,
      enableRowMultiSelect,
      selectedRecordIds.length,
      clearRowSelection,
      selectAllOnPage,
    ],
  );

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          [
            '[data-slot="popover-content"]',
            '[data-slot="select-content"]',
            '[data-slot="dropdown-menu-content"]',
            '[data-slot="dialog-content"]',
            '[data-slot="sheet-content"]',
            '[data-slot="command"]',
          ].join(","),
        )
      ) {
        return;
      }
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
      if (getFieldType(attribute.uiType).editorStyle === "toggle") return;
      setSelectedCell({ rowIndex, colId });
      setEditingCell(null);
    },
    [],
  );

  const handleCellDoubleClick = React.useCallback(
    (
      rowIndex: number,
      colId: string,
      attribute: Attribute,
      recordId: number,
    ) => {
      setSelectedCell({ rowIndex, colId });
      if (getFieldType(attribute.uiType).editorStyle === "toggle") {
        onCellUpdate(
          recordId,
          attribute.columnName,
          !getRecordValue(data[rowIndex] ?? {}, attribute.columnName),
        );
        return;
      }
      if (attribute.isPrimary) {
        onRowExpand?.(recordId);
        return;
      }
      setEditingCell({ rowIndex, colId });
    },
    [data, onCellUpdate, onRowExpand],
  );

  const handleMoveColumn = React.useCallback(
    (fieldId: string, direction: "left" | "right") => {
      const idx = sortableColumnIds.indexOf(fieldId);
      if (idx === -1) return;
      const newIdx = direction === "left" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sortableColumnIds.length) return;
      const targetFieldId = sortableColumnIds[newIdx];
      onSwapColumns?.(fieldId, targetFieldId);
    },
    [sortableColumnIds, onSwapColumns],
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
    handleColumnResize,
    handleMoveColumn,
    totalPages,
    total,
    singularName,
    pluralName,
    pagination,
    onPaginationChange,
    onRowExpand,
    onNewRecord,
    onAddSort,
    onHideColumn,
    onRenameColumn,
    onEditAttribute: props.onEditAttribute,
    onDeleteColumn: props.onDeleteColumn,
    onShowColumn: props.onShowColumn,
    enableRowMultiSelect,
    selectedRecordIds,
    clearRowSelection,
    onBulkDeleteRequest: props.onBulkDeleteRequest,
    extraContextMenuItems: props.extraContextMenuItems,
  };
}
