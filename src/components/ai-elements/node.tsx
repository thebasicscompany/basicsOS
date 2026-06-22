import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Handle, Position } from "@xyflow/react";
import type { ComponentProps } from "react";
import { AnimatedBorder } from "@/components/ui/animated-border";

export type WorkflowNodeProps = ComponentProps<typeof Card> & {
  handles: { target: boolean; source: boolean };
  status?: "idle" | "running" | "success" | "error";
};

export const WorkflowNode = ({
  handles,
  className,
  status,
  ...props
}: WorkflowNodeProps) => (
  <Card
    className={cn(
      "node-container relative size-full h-auto w-sm gap-0 rounded-md bg-card p-0 transition-all duration-200",
      status === "success" && "border-green-500 border-2",
      status === "error" && "border-red-500 border-2",
      className,
    )}
    {...props}
  >
    {status === "running" && <AnimatedBorder />}
    {handles.target && (
      <Handle
        position={Position.Left}
        type="target"
        className="!w-3 !h-3 !left-[-6px]"
      />
    )}
    {handles.source && (
      <Handle
        position={Position.Right}
        type="source"
        className="!w-3 !h-3 !right-[-6px]"
      />
    )}
    {props.children}
  </Card>
);

export const NodeHeader = ({
  className,
  ...props
}: ComponentProps<typeof CardHeader>) => (
  <CardHeader
    className={cn("gap-0.5 rounded-t-md border-b bg-secondary p-4!", className)}
    {...props}
  />
);

export const NodeTitle = (props: ComponentProps<typeof CardTitle>) => (
  <CardTitle {...props} />
);

export const NodeDescription = (
  props: ComponentProps<typeof CardDescription>,
) => <CardDescription {...props} />;

export const NodeAction = (props: ComponentProps<"div">) => <div {...props} />;

export const NodeContent = ({
  className,
  ...props
}: ComponentProps<typeof CardContent>) => (
  <CardContent
    className={cn("rounded-b-md bg-card p-4", className)}
    {...props}
  />
);

export const NodeFooter = ({
  className,
  ...props
}: ComponentProps<typeof CardFooter>) => (
  <CardFooter
    className={cn("rounded-b-md border-t bg-secondary p-4!", className)}
    {...props}
  />
);
