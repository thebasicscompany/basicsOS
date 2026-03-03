import { ReactFlow, type ReactFlowProps } from "@xyflow/react";
import type { ReactNode } from "react";
import "@xyflow/react/dist/style.css";

type CanvasProps = ReactFlowProps & {
  children?: ReactNode;
};

/** Matches Vercel workflow-builder-template Canvas */
export const WorkflowCanvas = ({ children, ...props }: CanvasProps) => {
  return (
    <ReactFlow
      defaultViewport={{ x: 0, y: 0, zoom: 1.1 }}
      deleteKeyCode={["Backspace", "Delete"]}
      fitView
      panActivationKeyCode={null}
      proOptions={{ hideAttribution: true }}
      selectionOnDrag={false}
      zoomOnDoubleClick={false}
      zoomOnPinch
      {...props}
    >
      {children}
    </ReactFlow>
  );
};
