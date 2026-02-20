import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils.js";

interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Left sidebar element (e.g. `<SidebarPanel>`). */
  sidebar?: ReactNode;
  /** Floating element rendered after the main content area (e.g. assistant panel). */
  floating?: ReactNode;
  /** Tailwind padding class for the main content area. Defaults to `p-8`. */
  contentPadding?: string;
  /** Tailwind max-width class for the inner content wrapper. Defaults to `max-w-6xl`. Set to `""` to disable. */
  contentMaxWidth?: string;
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  (
    {
      sidebar,
      floating,
      contentPadding = "p-8",
      contentMaxWidth = "max-w-6xl",
      className,
      children,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn("flex h-screen gap-3 bg-stone-200 p-3", className)}
      {...props}
    >
      {sidebar}
      <main
        className={cn(
          "flex-1 overflow-y-auto rounded-xl bg-stone-100",
          contentPadding,
        )}
      >
        {contentMaxWidth ? (
          <div className={cn("mx-auto", contentMaxWidth)}>{children}</div>
        ) : (
          children
        )}
      </main>
      {floating}
    </div>
  ),
);
AppShell.displayName = "AppShell";
