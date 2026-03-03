import * as React from "react";
import { flexRender, type ColumnDef, type Row } from "@tanstack/react-table";
import { PlusIcon, TableIcon } from "@phosphor-icons/react";
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Attribute } from "@/field-types/types";

export interface CellPosition {
  rowIndex: number;
  colId: string;
}

interface DataTableBodyProps<T extends Record<string, unknown>> {
  table: {
    getRowModel: () => { rows: Row<T>[] };
  };
  columns: ColumnDef<T>[];
  visibleCols: Array<{ attribute: Attribute }>;
  selectedCell: CellPosition | null;
  data: T[];
  isLoading: boolean;
  perPage: number;
  pluralName: string;
  singularName: string;
  onNewRecord?: () => void;
  onRowExpand?: (recordId: number) => void;
  onCellClick: (rowIndex: number, colId: string, attribute: Attribute) => void;
  onCellDoubleClick: (rowIndex: number, colId: string) => void;
}

export function DataTableBody<T extends Record<string, unknown>>({
  table,
  columns,
  visibleCols,
  selectedCell,
  data,
  isLoading,
  perPage,
  pluralName,
  singularName,
  onNewRecord,
  onRowExpand,
  onCellClick,
  onCellDoubleClick,
}: DataTableBodyProps<T>) {
  const rows = table.getRowModel().rows;

  return (
    <TableBody>
      {isLoading ? (
        Array.from({ length: Math.min(perPage, 10) }).map((_, i) => (
          <TableRow key={`skeleton-${i}`}>
            {columns.map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : data.length === 0 ? (
        <TableRow>
          <TableCell colSpan={columns.length} className="p-0">
            <EmptyState
              icon={<TableIcon />}
              title={`No ${pluralName.toLowerCase()} found`}
              description="Get started by creating your first record."
              action={
                onNewRecord ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNewRecord}
                  >
                    <PlusIcon className="size-3.5 mr-1" />
                    New {singularName}
                  </Button>
                ) : undefined
              }
            />
          </TableCell>
        </TableRow>
      ) : (
        rows.map((row) => (
          <TableRow
            key={row.id}
            onDoubleClick={
              onRowExpand
                ? () =>
                    onRowExpand(
                      (row.original as { Id?: number; id?: number }).Id ??
                        (row.original as { id?: number }).id ?? 0,
                    )
                : undefined
            }
            className={onRowExpand ? "cursor-pointer" : undefined}
          >
            {row.getVisibleCells().map((cell) => {
              const colDef = cell.column.columnDef;
              const colId = cell.column.id;
              const rowIndex = row.index;

              const isPrimaryAttr =
                visibleCols.length > 0 &&
                colId === visibleCols[0].attribute.id;

              const stickyStyle: React.CSSProperties = {};
              if (isPrimaryAttr) {
                stickyStyle.position = "sticky";
                stickyStyle.left = 0;
                stickyStyle.zIndex = 2;
              }

              const isSel =
                selectedCell?.rowIndex === rowIndex &&
                selectedCell?.colId === colId;

              const matchedCol = visibleCols.find(
                (c) => c.attribute.id === colId,
              );

              const fitContent = (colDef.meta as { fitContent?: boolean })?.fitContent;
              const sizeStyle = fitContent
                ? {
                    width: "max-content" as const,
                    minWidth: "max-content" as const,
                    whiteSpace: "nowrap" as const,
                  }
                : {
                    width: cell.column.getSize(),
                    minWidth: colDef.minSize,
                    maxWidth: colDef.maxSize,
                  };

              return (
                <TableCell
                  key={cell.id}
                  style={{ ...sizeStyle, ...stickyStyle }}
                  className={cn(
                    isPrimaryAttr && "bg-background",
                    isSel &&
                      "ring-2 ring-inset ring-primary/50 bg-primary/5",
                  )}
                  onClick={() => {
                    if (matchedCol) {
                      onCellClick(rowIndex, colId, matchedCol.attribute);
                    }
                  }}
                  onDoubleClick={() => {
                    if (matchedCol) {
                      onCellDoubleClick(rowIndex, colId);
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
        ))
      )}
    </TableBody>
  );
}
