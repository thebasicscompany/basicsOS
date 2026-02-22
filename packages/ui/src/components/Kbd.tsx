import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

interface KbdProps extends HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const Kbd = ({ className, children, ...props }: KbdProps): JSX.Element => (
  <kbd
    className={cn(
      "inline-flex h-5 items-center gap-0.5 rounded border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 px-1.5 font-mono text-[10px] font-medium text-stone-500 dark:text-stone-400",
      className,
    )}
    {...props}
  >
    {children}
  </kbd>
);
