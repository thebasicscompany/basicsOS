import { createContext, useContext, type ReactNode } from "react";

export interface AutomationBuilderContextValue {
  connectedProviders: string[];
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
  return ctx ?? { connectedProviders: [] };
}
