import * as React from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { Table } from "@/components/ui/table";
import { useDataTable } from "./useDataTable";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableBody } from "./DataTableBody";
import { DataTablePagination } from "./DataTablePagination";
import type { DataTableProps } from "./useDataTable";

// ---------------------------------------------------------------------------
// Types (re-export from hook)
// ---------------------------------------------------------------------------

export type { DataTableProps } from "./useDataTable";

// ---------------------------------------------------------------------------
// DataTable Component
// ---------------------------------------------------------------------------

export function DataTable(props: DataTableProps) {
  const {
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
  } = useDataTable(props);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={tableRef}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto rounded-md border bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={handleKeyDown}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
          <Table
            style={{
              width: "max-content",
              minWidth: "100%",
              tableLayout: "auto",
            }}
          >
            <DataTableHeader
              headerGroups={table.getHeaderGroups()}
              sortableColumnIds={sortableColumnIds}
              visibleCols={visibleCols}
              onColumnResize={handleColumnResize}
            />
            <DataTableBody
              table={table}
              columns={columns}
              visibleCols={visibleCols}
              selectedCell={selectedCell}
              data={props.data}
              isLoading={props.isLoading}
              perPage={pagination.perPage}
              pluralName={pluralName}
              singularName={singularName}
              onNewRecord={onNewRecord}
              onRowExpand={onRowExpand}
              onCellClick={handleCellClick}
              onCellDoubleClick={handleCellDoubleClick}
            />
          </Table>
        </DndContext>
      </div>

      <DataTablePagination
        total={total}
        singularName={singularName}
        pluralName={pluralName}
        page={pagination.page}
        perPage={pagination.perPage}
        totalPages={totalPages}
        onPaginationChange={onPaginationChange}
      />
    </div>
  );
}
