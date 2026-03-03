import { ReactFlow, Background, type ReactFlowProps } from "@xyflow/react";
import type { ReactNode } from "react";
import "@xyflow/react/dist/style.css";

type CanvasProps = ReactFlowProps & {
  children?: ReactNode;
};

/** Matches Vercel workflow-builder-template Canvas */
export const WorkflowCanvas = ({ children, ...props }: CanvasProps) => {
  return (
    <ReactFlow
      deleteKeyCode={["Backspace", "Delete"]}
      fitView
      panActivationKeyCode={null}
      proOptions={{ hideAttribution: true }}
      selectionOnDrag={false}
      zoomOnDoubleClick={false}
      zoomOnPinch
      {...props}
    >
      <Background gap={16} size={1} />
      {children}
    </ReactFlow>
  );
};
