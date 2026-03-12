import { useContext } from "react";
import { HelpCenterContext } from "@/contexts/help-center-context";

export function useHelpCenter() {
  const context = useContext(HelpCenterContext);
  if (!context) {
    throw new Error("useHelpCenter must be used within HelpCenterProvider");
  }
  return context;
}
