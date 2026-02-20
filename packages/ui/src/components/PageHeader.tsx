import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Back-navigation link href. Renders a "← label" link above the title. */
  backHref?: string;
  /** Label for the back link. Defaults to "Back". */
  backLabel?: string;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  action,
  backHref,
  backLabel = "Back",
  className,
}: PageHeaderProps): JSX.Element => (
  <div className={cn("flex items-start justify-between gap-4", className)}>
    <div>
      {backHref && (
        <a
          href={backHref}
          className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          &larr; {backLabel}
        </a>
      )}
      <h1
        className={cn(
          "text-2xl font-semibold font-serif tracking-tight text-stone-900",
          backHref && "mt-1",
        )}
      >
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
