import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends Omit<ComponentProps<"div">, "title"> {
  /** Icon to display above the title */
  icon?: ReactNode;
  /** Primary heading */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Optional action button or link */
  action?: ReactNode;
}

/**
 * Reusable empty state for lists, detail sections, and other "no data" scenarios.
 * Use icon + title + description + action for a consistent premium feel.
 */
export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[8rem] flex-col items-center justify-center gap-3 p-8 text-center",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          {icon && (
            <div className="text-muted-foreground [&>svg]:size-10">
              {icon}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="mt-1">{action}</div>}
        </>
      )}
    </div>
  );
}
