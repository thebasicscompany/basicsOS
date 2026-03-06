/**
 * Universal Cell component.
 *
 * Delegates ALL rendering to the field type registry. It is the single
 * entry-point for displaying or editing a value in a spreadsheet grid cell.
 *
 * Behaviour summary:
 *  - Protected records  -> gray "Protected record" text
 *  - isEditing          -> fieldType.CellEditor
 *  - empty value        -> placeholder text (gray, italic)
 *  - otherwise          -> fieldType.CellDisplay
 *  - Toggle-style types -> toggle directly, never enters "edit mode"
 */

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";

export interface CellProps {
  attribute: Attribute;
  value: any;
  isEditing: boolean;
  isSelected: boolean;
  isProtected?: boolean;
  onStartEditing: () => void;
  onSave: (value: any) => void;
  onCancel: () => void;
  cellRect?: DOMRect;
  className?: string;
}

export function Cell({
  attribute,
  value,
  isEditing,
  isSelected,
  isProtected = false,
  onStartEditing,
  onSave,
  onCancel,
  cellRect: _cellRect,
  className,
}: CellProps) {
  const fieldType = getFieldType(attribute.uiType);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isToggle = fieldType.editorStyle === "toggle";
  const displayValue = fieldType.formatDisplayValue(value, attribute.config);
  const shouldShowPreview =
    isSelected &&
    !isEditing &&
    !isToggle &&
    typeof displayValue === "string" &&
    displayValue.trim().length > 32;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isToggle) {
        e.stopPropagation();
        onSave(!value);
      }
    },
    [isToggle, onSave, value],
  );

  if (isProtected) {
    return (
      <div
        ref={wrapperRef}
        className={cn("flex min-h-[32px] items-center px-2", className)}
      >
        <span className="text-xs italic text-muted-foreground">
          Protected record
        </span>
      </div>
    );
  }

  if (isEditing && !isToggle) {
    const CellEditor = fieldType.CellEditor;
    return (
      <div
        ref={wrapperRef}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "flex min-h-[32px] items-center ring-2 ring-blue-500 rounded-sm",
          className,
        )}
      >
        <CellEditor
          value={value}
          config={attribute.config}
          attribute={attribute}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    );
  }

  const empty = fieldType.isEmpty(value);
  const CellDisplay = fieldType.CellDisplay;

  return (
    <div
      ref={wrapperRef}
      role="gridcell"
      tabIndex={isSelected ? 0 : -1}
      onClick={handleClick}
      className={cn(
        "relative flex min-h-[32px] items-center overflow-hidden px-2 cursor-default select-none",
        shouldShowPreview && "overflow-visible",
        isSelected && "ring-2 ring-blue-500 rounded-sm",
        className,
      )}
    >
      {empty ? (
        <span className="truncate text-xs italic text-muted-foreground">
          {fieldType.placeholder}
        </span>
      ) : (
        <CellDisplay
          value={value}
          config={attribute.config}
          attribute={attribute}
        />
      )}
      {shouldShowPreview && (
        <div className="absolute top-full left-0 z-20 mt-1 max-w-[420px] rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
          {displayValue}
        </div>
      )}
    </div>
  );
}
