import {
  useCallback,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  HelpCenterDialog,
  type HelpCenterMode,
} from "@/components/help/HelpCenterDialog";
import { HelpCenterContext } from "@/contexts/help-center-context";

export function HelpCenterProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<HelpCenterMode>("help");

  const openHelp = useCallback(() => {
    setMode("help");
    setOpen(true);
  }, []);

  const openOnboarding = useCallback(() => {
    setMode("onboarding");
    setOpen(true);
  }, []);

  const closeHelpCenter = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      openHelp,
      openOnboarding,
      closeHelpCenter,
    }),
    [closeHelpCenter, openHelp, openOnboarding],
  );

  return (
    <HelpCenterContext.Provider value={value}>
      {children}
      <HelpCenterDialog
        open={open}
        mode={mode}
        onOpenChange={setOpen}
        onReplayOnboarding={openOnboarding}
      />
    </HelpCenterContext.Provider>
  );
}
