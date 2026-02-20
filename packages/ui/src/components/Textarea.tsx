import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-stone-400 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
