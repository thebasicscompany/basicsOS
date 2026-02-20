import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  action,
  className,
}: PageHeaderProps): JSX.Element => (
  <div className={cn("flex items-start justify-between gap-4", className)}>
    <div>
      <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
