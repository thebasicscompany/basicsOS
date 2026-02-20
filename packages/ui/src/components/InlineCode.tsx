import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export const InlineCode = ({
  className,
  ...props
}: HTMLAttributes<HTMLElement>): JSX.Element => (
  <code
    className={cn(
      "rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-700 border border-stone-200",
      className,
    )}
    {...props}
  />
);
