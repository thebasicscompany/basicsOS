import { createContext } from "react";

export type HelpCenterContextValue = {
  openHelp: () => void;
  openOnboarding: () => void;
  closeHelpCenter: () => void;
};

export const HelpCenterContext = createContext<HelpCenterContextValue | null>(
  null,
);
