import { useMemo, useCallback, useEffect, useState } from "react";
import { usePageTitle, usePageHeaderActions } from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";

const isElectron = () =>
  typeof window !== "undefined" && !!window.electronAPI;

export function VoiceApp() {
  usePageTitle("Voice");
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (!isElectron()) return;
    void window.electronAPI?.getOverlayStatus?.().then((status) => {
      setOverlayVisible(!!status?.visible);
    });
    window.electronAPI?.onOverlayStatusChanged?.((status) => {
      setOverlayVisible(!!status?.visible);
    });
  }, []);

  const handleOverlayToggle = useCallback(() => {
    if (overlayVisible) {
      window.electronAPI?.hideOverlay?.();
      return;
    }
    window.electronAPI?.showOverlay?.();
  }, [overlayVisible]);

  const headerActionsNode = useMemo(() => {
    if (!isElectron()) return null;
    return (
      <Button onClick={handleOverlayToggle}>
        {overlayVisible ? "Close active" : "Launch Voice Overlay"}
      </Button>
    );
  }, [handleOverlayToggle, overlayVisible]);
  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

  if (!isElectron()) {
    return (
      <>
        {headerActionsPortal}
        <div className="flex h-full flex-col overflow-auto py-4">
          <p className="mb-4 text-[12px] text-muted-foreground">
            Voice overlay configuration
          </p>
          <div className="max-w-lg space-y-4">
            <div className="rounded-lg border p-4">
              <h2 className="text-[13px] font-medium">Desktop app required</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Voice overlay is available in the Basics OS desktop app. Download
                and run the desktop app to use voice commands, dictation, and the
                AI assistant overlay.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {headerActionsPortal}
      <div className="flex h-full flex-col overflow-auto py-4">
        <p className="mb-4 text-[12px] text-muted-foreground">
          Voice overlay configuration
        </p>

        <div className="max-w-lg space-y-4">
          <div className="rounded-lg border p-4">
            <h2 className="text-[13px] font-medium">Voice overlay</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              The voice pill is a separate overlay window that floats at the top
              of your screen. Use global shortcuts to activate it, or launch it
              from the header button.
            </p>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Use{" "}
              <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                Ctrl+Space
              </kbd>{" "}
              (or{" "}
              <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                Cmd+Space
              </kbd>{" "}
              on Mac) to activate the AI assistant.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-[13px] font-medium">Current capabilities</h2>
            <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
              <li>Ask CRM-aware questions (pipeline, deals, contacts, tasks)</li>
              <li>Dictation and transcription shortcuts</li>
              <li>Navigation voice commands (open contacts, deals, settings)</li>
              <li>
                CRM write actions from voice (create task, add note, update deal
                stage)
              </li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-[13px] font-medium">Shortcuts</h2>
            <ul className="mt-2 space-y-1.5 text-[12px] text-muted-foreground">
              <li>
                <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                  Ctrl+Space
                </kbd>{" "}
                — AI Assistant (tap to listen, auto-stops after silence)
              </li>
              <li>
                Double-tap{" "}
                <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                  Ctrl+Space
                </kbd>{" "}
                — Continuous listening
              </li>
              <li>
                <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                  Ctrl+Shift+Space
                </kbd>{" "}
                — Dictation (hold to record, release to transcribe and paste)
              </li>
              <li>
                <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
                  Ctrl+Alt+Space
                </kbd>{" "}
                — Meeting toggle (stub)
              </li>
            </ul>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-[13px] font-medium">Requirements</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Add your Basics API key in Settings for transcription, TTS, and AI
              streaming. The overlay uses session auth from your logged-in CRM
              session.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
