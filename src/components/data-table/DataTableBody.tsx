import * as React from "react";
import { flexRender, type ColumnDef, type Row } from "@tanstack/react-table";
import { ArrowSquareOutIcon, TrashIcon } from "@phosphor-icons/react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
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
  onRowDelete?: (recordId: number, record: T) => void;
  onCellClick: (rowIndex: number, colId: string, attribute: Attribute) => void;
  onCellDoubleClick: (
    rowIndex: number,
    colId: string,
    attribute: Attribute,
    recordId: number,
  ) => void;
}

export function DataTableBody<T extends Record<string, unknown>>({
  table,
  columns,
  visibleCols,
  selectedCell,
  data: _data,
  isLoading,
  perPage,
  pluralName: _pluralName,
  singularName: _singularName,
  onNewRecord: _onNewRecord,
  onRowExpand,
  onRowDelete,
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
      ) : (
        rows.map((row) => {
          const recordId =
            (row.original as { Id?: number; id?: number }).Id ??
            (row.original as { id?: number }).id ??
            0;
          const rowContent = (
            <TableRow
              key={row.id}
              className={onRowExpand ? "cursor-default" : undefined}
            >
              {row.getVisibleCells().map((cell) => {
              const colDef = cell.column.columnDef;
              const colId = cell.column.id;
              const rowIndex = row.index;

              const isPrimaryAttr =
                visibleCols.length > 0 && colId === visibleCols[0].attribute.id;

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

              const fitContent = (colDef.meta as { fitContent?: boolean })
                ?.fitContent;
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
                    isSel && "ring-2 ring-inset ring-primary/50 bg-primary/5",
                  )}
                  onClick={() => {
                    if (matchedCol) {
                      onCellClick(rowIndex, colId, matchedCol.attribute);
                    }
                  }}
                  onDoubleClick={() => {
                    if (matchedCol) {
                      onCellDoubleClick(
                        rowIndex,
                        colId,
                        matchedCol.attribute,
                        recordId,
                      );
                    }
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              );
            })}
            </TableRow>
          );

          const hasActions = onRowExpand || onRowDelete;
          if (!hasActions) {
            return rowContent;
          }

          return (
            <ContextMenu key={row.id}>
              <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
              <ContextMenuContent>
                {onRowExpand && (
                  <ContextMenuItem onClick={() => onRowExpand(recordId)}>
                    <ArrowSquareOutIcon className="mr-2 h-4 w-4" />
                    Open
                  </ContextMenuItem>
                )}
                {onRowDelete && (
                  <>
                    {onRowExpand && <ContextMenuSeparator />}
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => onRowDelete(recordId, row.original)}
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })
      )}
    </TableBody>
  );
}
