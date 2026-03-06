import { PlusIcon, TableIcon } from "@phosphor-icons/react";
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
              onColumnResize={handleColumnResize}
              onAddSort={onAddSort}
              onHideColumn={onHideColumn}
              onRenameColumn={onRenameColumn}
              onMoveColumn={handleMoveColumn}
              onEditAttribute={onEditAttribute}
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
              onRowDelete={props.onRowDelete}
              onCellClick={handleCellClick}
              onCellDoubleClick={handleCellDoubleClick}
            />
          </Table>
        )}
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
