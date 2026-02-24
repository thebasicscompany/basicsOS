import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils.js";

interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Left sidebar element (e.g. `<SidebarPanel>` or `<IconRail>`). */
  sidebar?: ReactNode;
  /** Floating element rendered after the main content area (e.g. assistant panel). */
  floating?: ReactNode;
  /** Tailwind padding class for the main content area. Defaults to `p-8`. */
  contentPadding?: string;
  /** Tailwind max-width class for the inner content wrapper. Set to `""` to disable. */
  contentMaxWidth?: string;
  /** `"sidebar"` uses the full labeled sidebar (240px). `"rail"` uses the compact icon rail (56px). */
  variant?: "sidebar" | "rail";
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  (
    {
      sidebar,
      floating,
      contentPadding = "p-8",
      contentMaxWidth,
      variant = "sidebar",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isRail = variant === "rail";
    const resolvedMaxWidth = contentMaxWidth ?? (isRail ? "max-w-7xl" : "max-w-6xl");

    return (
      <div
        ref={ref}
        className={cn(
          "flex h-screen",
          isRail ? "gap-0 p-0" : "gap-3 p-3",
          className,
        )}
        {...props}
      >
        {sidebar}
        <main
          className={cn(
            "flex-1 overflow-y-auto rounded-sm bg-stone-100 dark:bg-stone-900",
            contentPadding,
          )}
        >
          {resolvedMaxWidth ? (
            <div className={cn("mx-auto", resolvedMaxWidth)}>{children}</div>
          ) : (
            children
          )}
        </main>
        {floating}
      </div>
    );
  },
);
AppShell.displayName = "AppShell";
