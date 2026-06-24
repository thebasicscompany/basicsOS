import * as React from "react";
import {
  flexRender,
  type Header,
  type HeaderGroup,
} from "@tanstack/react-table";
import { TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { getNameAttributes } from "@/lib/crm/display-name";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import type { Attribute } from "@/field-types/types";
import {
  DATA_TABLE_ROW_SELECT_COLUMN_ID,
  DATA_TABLE_SELECT_COL_WIDTH,
} from "./DataTableRowSelectCells";

interface DataTableHeaderProps<T> {
  headerGroups: HeaderGroup<T>[];
  sortableColumnIds: string[];
  visibleCols: Array<{
    attribute: Attribute;
    viewColumn: { fieldId: string; title: string };
  }>;
  singularName: string;
  enableRowMultiSelect?: boolean;
  onColumnResize: (fieldId: string, delta: number) => void;
  onAddSort?: (fieldId: string, direction: "asc" | "desc") => void;
  onHideColumn?: (fieldId: string) => void;
  onRenameColumn?: (fieldId: string, title: string) => void;
  onMoveColumn?: (fieldId: string, direction: "left" | "right") => void;
  onEditAttribute?: (fieldId: string) => void;
  onDeleteColumn?: (fieldId: string) => void;
}

export function DataTableHeader<T extends Record<string, unknown>>({
  headerGroups,
  sortableColumnIds,
  visibleCols,
  singularName,
  enableRowMultiSelect = false,
  onColumnResize,
  onAddSort,
  onHideColumn,
  onRenameColumn,
  onMoveColumn,
  onEditAttribute,
  onDeleteColumn,
}: DataTableHeaderProps<T>) {
  const { firstNameAttr, usesSplitName } = React.useMemo(
    () => getNameAttributes(visibleCols.map((col) => col.attribute)),
    [visibleCols],
  );

  return (
    <TableHeader>
      {headerGroups.map((headerGroup) => (
        <TableRow key={headerGroup.id}>
          {headerGroup.headers.map((header: Header<T, unknown>) => {
            const colIndex = sortableColumnIds.indexOf(header.id);
            const isDataColumn = colIndex !== -1;
            const visCol = visibleCols.find(
              (c) => c.attribute.id === header.id,
            );
            const isSelectCol = header.id === DATA_TABLE_ROW_SELECT_COLUMN_ID;
            const isPrimaryAttr =
              visibleCols.length > 0 &&
              header.id === visibleCols[0].attribute.id;

            const stickyStyle: React.CSSProperties = {};
            if (isSelectCol) {
              stickyStyle.position = "sticky";
              stickyStyle.left = 0;
              stickyStyle.zIndex = 5;
            } else if (isPrimaryAttr) {
              stickyStyle.position = "sticky";
              stickyStyle.left = enableRowMultiSelect
                ? DATA_TABLE_SELECT_COL_WIDTH
                : 0;
              stickyStyle.zIndex = 3;
            }

            const fitContent = (
              header.column.columnDef.meta as { fitContent?: boolean }
            )?.fitContent;
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

            const headerContent = header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext());

            if (isDataColumn && visCol) {
              const isCombinedNameColumn =
                usesSplitName &&
                firstNameAttr != null &&
                visCol.attribute.columnName === firstNameAttr.columnName;
              const displayTitle = isCombinedNameColumn
                ? "Name"
                : visCol.attribute.isPrimary
                  ? singularName
                  : visCol.attribute.name || visCol.viewColumn.title;

              return (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={
                    isPrimaryAttr || isSelectCol ? "bg-background" : undefined
                  }
                  style={{ ...sizeStyle, ...stickyStyle }}
                >
                  <ColumnHeaderMenu
                    fieldId={header.id}
                    currentTitle={displayTitle}
                    isPrimary={visCol.attribute.isPrimary}
                    canMoveLeft={colIndex > 0}
                    canMoveRight={colIndex < sortableColumnIds.length - 1}
                    onSortAsc={() => onAddSort?.(header.id, "asc")}
                    onSortDesc={() => onAddSort?.(header.id, "desc")}
                    onMoveLeft={() => onMoveColumn?.(header.id, "left")}
                    onMoveRight={() => onMoveColumn?.(header.id, "right")}
                    onRename={(title) => onRenameColumn?.(header.id, title)}
                    onHide={() => onHideColumn?.(header.id)}
                    onEditAttribute={
                      onEditAttribute
                        ? () => onEditAttribute(header.id)
                        : undefined
                    }
                    onDelete={
                      onDeleteColumn && header.id.startsWith("custom_")
                        ? () => onDeleteColumn(header.id)
                        : undefined
                    }
                  >
                    {headerContent}
                  </ColumnHeaderMenu>
                  {header.column.getCanResize() && (
                    <ColumnResizeHandle
                      onResize={(delta) => onColumnResize(header.id, delta)}
                    />
                  )}
                </TableHead>
              );
            }

            return (
              <TableHead
                key={header.id}
                colSpan={header.colSpan}
                className={
                  isPrimaryAttr || isSelectCol ? "bg-background" : undefined
                }
                style={{
                  width: header.getSize(),
                  minWidth: header.column.columnDef.minSize,
                  maxWidth: header.column.columnDef.maxSize,
                  ...stickyStyle,
                }}
              >
                {headerContent}
              </TableHead>
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
  );
}
