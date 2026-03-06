/**
 * DetailField — a field component for the record detail page sidebar.
 *
 * Renders a label + value pair. Clicking the value enters inline edit mode.
 * Blur/Escape cancels; Enter or an explicit save commits.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getFieldType } from "@/field-types";
import type { Attribute } from "@/field-types/types";

export interface DetailFieldProps {
  attribute: Attribute;
  value: any;
  onSave: (value: any) => void;
  isReadOnly?: boolean;
}

export function DetailField({
  attribute,
  value,
  onSave,
  isReadOnly = false,
}: DetailFieldProps) {
  const fieldType = getFieldType(attribute.uiType);
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const linkClickTimeoutRef = useRef<number | null>(null);

  const isCheckbox = attribute.uiType === "checkbox";

  const IconComponent = fieldType.icon;

  const handleStartEditing = useCallback(() => {
    if (isReadOnly) return;
    if (isCheckbox) return; // checkbox toggles directly
    setIsEditing(true);
  }, [isReadOnly, isCheckbox]);

  const handleSave = useCallback(
    (newValue: any) => {
      setIsEditing(false);
      onSave(newValue);
    },
    [onSave],
  );

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleCheckboxToggle = useCallback(() => {
    if (isReadOnly) return;
    onSave(!value);
  }, [isReadOnly, value, onSave]);

  useEffect(() => {
    if (!isEditing) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsEditing(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (linkClickTimeoutRef.current != null) {
        window.clearTimeout(linkClickTimeoutRef.current);
      }
    };
  }, []);

  const openExternalTarget = useCallback((anchor: HTMLAnchorElement) => {
    const href = anchor.getAttribute("href");
    if (!href) return;

    const target = anchor.getAttribute("target");
    if (target === "_blank") {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = href;
  }, []);

  const handleLinkClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor || isEditing) return;

      event.preventDefault();
      event.stopPropagation();

      if (linkClickTimeoutRef.current != null) {
        window.clearTimeout(linkClickTimeoutRef.current);
      }

      linkClickTimeoutRef.current = window.setTimeout(() => {
        openExternalTarget(anchor as HTMLAnchorElement);
        linkClickTimeoutRef.current = null;
      }, 220);
    },
    [isEditing, openExternalTarget],
  );

  const handleLinkDoubleClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      event.preventDefault();
      event.stopPropagation();

      if (linkClickTimeoutRef.current != null) {
        window.clearTimeout(linkClickTimeoutRef.current);
        linkClickTimeoutRef.current = null;
      }

      if (!isReadOnly) {
        handleStartEditing();
      }
    },
    [handleStartEditing, isReadOnly],
  );

  const empty = fieldType.isEmpty(value);

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 items-start py-1.5 overflow-hidden"
    >
      {/* Label */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-h-[28px]">
        {IconComponent && <IconComponent />}
        <span className="truncate">{attribute.name}</span>
      </div>

      {/* Value / Editor */}
      <div className="min-h-[28px] min-w-0 flex items-start overflow-hidden">
        {isEditing ? (
          <fieldType.DetailEditor
            value={value}
            config={attribute.config}
            attribute={attribute}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : isCheckbox ? (
          <button
            type="button"
            onClick={handleCheckboxToggle}
            disabled={isReadOnly}
            className={cn(
              "cursor-pointer",
              isReadOnly && "opacity-50 cursor-not-allowed",
            )}
          >
            <fieldType.DetailDisplay
              value={value}
              config={attribute.config}
              attribute={attribute}
            />
          </button>
        ) : (
          <div
            onClickCapture={handleLinkClickCapture}
            onDoubleClickCapture={handleLinkDoubleClickCapture}
            onDoubleClick={() => {
              if (!isReadOnly) {
                handleStartEditing();
              }
            }}
            className={cn(
              "w-full min-w-0 text-left rounded px-1 -mx-1 py-0.5 transition-colors overflow-hidden [&_.truncate]:overflow-visible [&_.truncate]:whitespace-normal [&_.truncate]:break-words [&_.truncate]:text-clip [&_.inline-flex]:max-w-full [&_.inline-flex]:whitespace-normal [&_.inline-flex]:break-words [&_a]:block [&_a]:max-w-full [&_a]:overflow-visible [&_a]:whitespace-normal [&_a]:break-all",
              !isReadOnly && "hover:bg-muted cursor-pointer",
              isReadOnly && "cursor-default",
            )}
          >
            {empty ? (
              <span className="text-xs italic text-muted-foreground">
                {fieldType.placeholder}
              </span>
            ) : (
              <span className="block max-h-40 overflow-y-auto break-words pr-1 text-sm">
                <fieldType.DetailDisplay
                  value={value}
                  config={attribute.config}
                  attribute={attribute}
                />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
