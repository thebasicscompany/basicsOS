import { Card, CardContent, CardHeader, CardTitle } from "basics-os/src/components/ui/card";
import { Button } from "basics-os/src/components/ui/button";

const isElectron = () =>
  typeof window !== "undefined" && "electronAPI" in window && window.electronAPI;

export function VoiceApp() {
  if (!isElectron()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Voice overlay is available in the Basics OS desktop app. Download and
            run the desktop app to use voice commands, dictation, and the AI
            assistant overlay.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleLaunch = () => {
    window.electronAPI?.showOverlay?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Overlay</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-muted-foreground">
          The voice pill is a separate overlay window that floats at the top of
          your screen. Use global shortcuts to activate it.
        </p>

        <div className="flex flex-col gap-4">
          <Button onClick={handleLaunch} size="lg">
            Launch Voice Overlay
          </Button>
          <p className="text-sm text-muted-foreground">
            Shows and focuses the pill overlay window. You can also use{" "}
            <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
              Ctrl+Space
            </kbd>{" "}
            (or <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">
              ⌘+Space
            </kbd>{" "}
            on Mac) to activate the AI assistant.
          </p>
        </div>

        <div className="space-y-4 border-t pt-6">
          <h4 className="text-sm font-medium">Shortcuts</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
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
              — Meeting toggle (stub — no backend)
            </li>
          </ul>
        </div>

        <div className="space-y-4 border-t pt-6">
          <h4 className="text-sm font-medium">Requirements</h4>
          <p className="text-sm text-muted-foreground">
            Add your Basics API key in Settings for transcription, TTS, and AI
            streaming. The overlay uses session auth from your logged-in CRM
            session.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
