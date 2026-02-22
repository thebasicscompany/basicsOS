import type { ComponentType, SVGProps } from "react";
import { cn } from "../lib/utils.js";

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

interface IconBadgeProps {
  /** Lucide icon component. */
  Icon: LucideIcon;
  /** Size variant. */
  size?: "sm" | "md" | "lg";
  /** Tailwind bg + text color classes (e.g. `"bg-violet-50 text-violet-600"`). Defaults to stone. */
  color?: string;
  className?: string;
}

const sizeMap = {
  sm: { container: "h-8 w-8", icon: 16 },
  md: { container: "h-10 w-10", icon: 20 },
  lg: { container: "h-12 w-12", icon: 24 },
} as const;

export const IconBadge = ({
  Icon,
  size = "md",
  color = "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400",
  className,
}: IconBadgeProps): JSX.Element => {
  const s = sizeMap[size];
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg",
        s.container,
        color,
        className,
      )}
    >
      <Icon size={s.icon} />
    </div>
  );
};
