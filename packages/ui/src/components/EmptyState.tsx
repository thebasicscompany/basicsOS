import type { ComponentType, SVGProps, ReactNode } from "react";
import { cn } from "../lib/utils.js";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

interface EmptyStateProps {
  Icon: LucideIcon;
  heading: string;
  description?: string;
  action?: ReactNode;
  /** Override container classes. Merged with defaults via cn(). */
  className?: string;
  /** Override the icon container color. Defaults to `bg-stone-200 text-stone-500`. */
  iconClassName?: string;
}

export const EmptyState = ({
  Icon,
  heading,
  description,
  action,
  className,
  iconClassName,
}: EmptyStateProps): JSX.Element => (
  <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
    <div
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-lg bg-stone-200 text-stone-500 mb-4",
        iconClassName,
      )}
    >
      <Icon size={24} />
    </div>
    <h3 className="text-base font-semibold font-serif text-stone-900">{heading}</h3>
    {description && (
      <p className="mt-1 text-sm text-stone-500 max-w-sm">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
