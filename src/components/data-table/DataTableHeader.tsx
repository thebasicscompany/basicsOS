import * as React from "react";
import { flexRender, type Header, type HeaderGroup } from "@tanstack/react-table";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { SortableHeaderCell } from "./SortableHeaderCell";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import type { Attribute } from "@/field-types/types";

interface DataTableHeaderProps<T> {
  headerGroups: HeaderGroup<T>[];
  sortableColumnIds: string[];
  visibleCols: Array<{ attribute: Attribute; viewColumn: { fieldId: string } }>;
  onColumnResize: (fieldId: string, delta: number) => void;
}

export function DataTableHeader<T extends Record<string, unknown>>({
  headerGroups,
  sortableColumnIds,
  visibleCols,
  onColumnResize,
}: DataTableHeaderProps<T>) {
  return (
    <TableHeader>
      {headerGroups.map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          <SortableContext
            items={sortableColumnIds}
            strategy={horizontalListSortingStrategy}
          >
            {headerGroup.headers.map((header: Header<T, unknown>) => {
              const isSortable = sortableColumnIds.includes(header.id);
              const isPrimaryAttr =
                visibleCols.length > 0 &&
                header.id === visibleCols[0].attribute.id;

              const stickyStyle: React.CSSProperties = {};
              if (isPrimaryAttr) {
                stickyStyle.position = "sticky";
                stickyStyle.left = 0;
                stickyStyle.zIndex = 3;
              }

              const fitContent = (header.column.columnDef.meta as { fitContent?: boolean })?.fitContent;
              const sizeStyle = fitContent
                ? {
                    width: "max-content" as const,
                    minWidth: "max-content" as const,
                    whiteSpace: "nowrap" as const,
                  }
                : {
                    width: header.getSize(),
                    minWidth: header.column.columnDef.minSize,
                    maxWidth: header.column.columnDef.maxSize,
                  };

              if (isSortable) {
                return (
                  <SortableHeaderCell
                    key={header.id}
                    id={header.id}
                    colSpan={header.colSpan}
                    className={isPrimaryAttr ? "bg-background" : undefined}
                    style={{ ...sizeStyle, ...stickyStyle }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {header.column.getCanResize() && (
                      <ColumnResizeHandle
                        onResize={(delta) => onColumnResize(header.id, delta)}
                      />
                    )}
                  </SortableHeaderCell>
                );
              }

              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={isPrimaryAttr ? "bg-background" : undefined}
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
  );
}
