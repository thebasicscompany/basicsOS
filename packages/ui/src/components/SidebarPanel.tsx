import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils.js";

interface SidebarPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Slot rendered at the top (e.g. brand logo). */
  header?: ReactNode;
  /** Slot rendered at the bottom with a top border (e.g. user widget). */
  footer?: ReactNode;
  /** Tailwind width class. Defaults to `w-60`. */
  width?: string;
}

export const SidebarPanel = forwardRef<HTMLDivElement, SidebarPanelProps>(
  ({ header, footer, width = "w-60", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full shrink-0 flex-col",
        width,
        className,
      )}
      {...props}
    >
      {header && <div className="px-4 pt-8 pb-4">{header}</div>}
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer && (
        <div className="px-4 pt-4 pb-3">{footer}</div>
      )}
    </div>
  ),
);
SidebarPanel.displayName = "SidebarPanel";
