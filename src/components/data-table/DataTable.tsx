import { PlusIcon, TableIcon, TrashIcon } from "@phosphor-icons/react";
import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useDataTable } from "./useDataTable";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableBody } from "./DataTableBody";
import { DataTablePagination } from "./DataTablePagination";
import type { DataTableProps } from "./useDataTable";

export type { DataTableProps } from "./useDataTable";

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
    onEditAttribute,
    onDeleteColumn,
    enableRowMultiSelect,
    selectedRecordIds,
    clearRowSelection,
    onBulkDeleteRequest,
    extraContextMenuItems,
  } = useDataTable(props);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={tableRef}
        tabIndex={0}
        className="flex min-h-0 flex-1 flex-col overflow-auto rounded-md bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={handleKeyDown}
      >
        {!props.isLoading && props.data.length === 0 ? (
          <EmptyState
            className="flex-1"
            icon={<TableIcon />}
            title={`No ${pluralName.toLowerCase()} found`}
            description="Get started by creating your first record."
            action={
              onNewRecord ? (
                <Button variant="outline" size="sm" onClick={onNewRecord}>
                  <PlusIcon className="size-3.5 mr-1" />
                  New {singularName}
                </Button>
              ) : undefined
            }
          />
        ) : (
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
              singularName={singularName}
              enableRowMultiSelect={enableRowMultiSelect}
              onColumnResize={handleColumnResize}
              onAddSort={onAddSort}
              onHideColumn={onHideColumn}
              onRenameColumn={onRenameColumn}
              onMoveColumn={handleMoveColumn}
              onEditAttribute={onEditAttribute}
              onDeleteColumn={onDeleteColumn}
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
              enableRowMultiSelect={enableRowMultiSelect}
              onNewRecord={onNewRecord}
              onRowExpand={onRowExpand}
              onRowDelete={props.onRowDelete}
              extraContextMenuItems={extraContextMenuItems}
              onCellClick={handleCellClick}
              onCellDoubleClick={handleCellDoubleClick}
            />
          </Table>
        )}
      </div>

      {enableRowMultiSelect &&
        selectedRecordIds.length > 0 &&
        onBulkDeleteRequest && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">
              {selectedRecordIds.length} selected
            </span>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={clearRowSelection}>
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkDeleteRequest(selectedRecordIds)}
            >
              <TrashIcon className="mr-1.5 size-3.5" />
              Delete
            </Button>
          </div>
        )}

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
