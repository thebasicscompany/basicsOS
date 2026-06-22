import { cn } from "@/lib/utils";
import { Panel as PanelPrimitive } from "@xyflow/react";
import type { ComponentProps } from "react";

type PanelProps = ComponentProps<typeof PanelPrimitive>;

/** Matches Vercel workflow-builder-template Panel */
export const Panel = ({ className, ...props }: PanelProps) => (
  <PanelPrimitive
    className={cn("m-4 rounded-md border bg-card p-3", className)}
    {...props}
  />
);
