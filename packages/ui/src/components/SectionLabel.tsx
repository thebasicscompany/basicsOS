import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

type SectionLabelElement = "p" | "h2" | "h3" | "span";

interface SectionLabelProps extends HTMLAttributes<HTMLElement> {
  /** Semantic HTML element to render. Defaults to `"p"`. */
  as?: SectionLabelElement;
}

export const SectionLabel = ({
  as: Tag = "p",
  className,
  ...props
}: SectionLabelProps): JSX.Element => (
  <Tag
    className={cn(
      "text-xs font-semibold uppercase tracking-widest text-stone-500",
      className,
    )}
    {...props}
  />
);
