import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

interface KbdProps extends HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const Kbd = ({ className, children, ...props }: KbdProps): JSX.Element => (
  <kbd
    className={cn(
      "inline-flex h-5 items-center gap-0.5 rounded border border-stone-200 bg-stone-100 px-1.5 font-mono text-[10px] font-medium text-stone-500",
      className,
    )}
    {...props}
  >
    {children}
  </kbd>
);
