"use client";

import { forwardRef } from "react";
import type { ReactNode } from "react";
import { Command } from "cmdk";
import { Search, X } from "lucide-react";
import { cn } from "../lib/utils.js";

/* -------------------------------------------------------------------------- */
/*  Overlay + Root                                                            */
/* -------------------------------------------------------------------------- */

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
  /** Placeholder text in the search input */
  placeholder?: string;
}

export const CommandPalette = ({
  open,
  onOpenChange,
  children,
  placeholder = "Search commands\u2026",
}: CommandPaletteProps): JSX.Element | null => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette */}
      <Command
        className={cn(
          "relative w-full max-w-[560px] rounded-lg border border-stone-200 bg-white shadow-lg",
          "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
          "flex flex-col overflow-hidden",
        )}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-stone-100 px-3">
          <Search size={16} className="mr-2 shrink-0 text-stone-400" />
          <Command.Input
            placeholder={placeholder}
            className="flex h-11 w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 outline-none"
            autoFocus
          />
          <button
            onClick={() => onOpenChange(false)}
            className="ml-2 shrink-0 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Command list */}
        <Command.List className="max-h-[340px] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-stone-400">
            No results found.
          </Command.Empty>
          {children}
        </Command.List>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-stone-100 px-3 py-2">
          <span className="text-[11px] text-stone-400">
            <kbd className="font-mono">Enter</kbd> to select
          </span>
          <span className="text-[11px] text-stone-400">
            <kbd className="font-mono">Esc</kbd> to close
          </span>
          <span className="text-[11px] text-stone-400">
            <kbd className="font-mono">&uarr;&darr;</kbd> to navigate
          </span>
        </div>
      </Command>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                           */
/* -------------------------------------------------------------------------- */

interface CommandPaletteGroupProps {
  heading: string;
  children: ReactNode;
}

export const CommandPaletteGroup = ({ heading, children }: CommandPaletteGroupProps): JSX.Element => (
  <Command.Group
    heading={heading}
    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-stone-400"
  >
    {children}
  </Command.Group>
);

interface CommandPaletteItemProps {
  /** Called when this item is selected */
  onSelect?: () => void;
  /** Icon element to show left of the label */
  icon?: ReactNode;
  /** Keyboard shortcut hint to show on the right */
  shortcut?: string;
  /** Secondary text */
  description?: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

export const CommandPaletteItem = forwardRef<HTMLDivElement, CommandPaletteItemProps>(
  ({ onSelect, icon, shortcut, description, disabled, className, children }, ref) => (
    <Command.Item
      ref={ref}
      {...(onSelect ? { onSelect: () => onSelect() } : {})}
      {...(disabled ? { disabled: true } : {})}
      className={cn(
        "flex h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-stone-700",
        "select-none",
        "data-[selected=true]:bg-stone-100 data-[selected=true]:text-stone-900",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
    >
      {icon && <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {description && <span className="text-xs text-stone-400 truncate">{description}</span>}
      {shortcut && (
        <kbd className="ml-auto inline-flex h-5 items-center rounded border border-stone-200 bg-stone-50 px-1.5 font-mono text-[10px] text-stone-400">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  ),
);
CommandPaletteItem.displayName = "CommandPaletteItem";

export const CommandPaletteEmpty = ({ children }: { children: ReactNode }): JSX.Element => (
  <Command.Empty className="py-8 text-center text-sm text-stone-400">{children}</Command.Empty>
);

export const CommandPaletteInput = Command.Input;
