import { createContext, useContext, type ReactNode } from "react";
import type { Edge } from "@xyflow/react";
import type { WorkflowNode } from "./builderConstants";

export interface AutomationBuilderContextValue {
  connectedProviders: string[];
  nodes: WorkflowNode[];
  edges: Edge[];
  nodeTypeLabels: Record<string, string>;
}

const AutomationBuilderContext = createContext<AutomationBuilderContextValue | null>(null);

export function AutomationBuilderProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AutomationBuilderContextValue;
}) {
  return (
    <AutomationBuilderContext.Provider value={value}>
      {children}
    </AutomationBuilderContext.Provider>
  );
}

export function useAutomationBuilder(): AutomationBuilderContextValue {
  const ctx = useContext(AutomationBuilderContext);
  return (
    ctx ?? {
      connectedProviders: [],
      nodes: [],
      edges: [],
      nodeTypeLabels: {},
    }
  );
}
