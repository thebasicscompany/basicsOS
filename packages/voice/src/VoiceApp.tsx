import { useMemo, useCallback, useEffect, useState } from "react";
import {
  usePageTitle,
  usePageHeaderActions,
} from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";
import { Kbd } from "basics-os/src/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "basics-os/src/components/ui/select";
import { Label } from "basics-os/src/components/ui/label";
import { getPrimaryModifierLabel } from "basics-os/src/lib/keyboard-shortcuts";
import { toast } from "sonner";

/** Shape of overlay settings used for microphone selection (matches shared-overlay types). */
type OverlaySettings = {
  voice: {
    audioInputDeviceId: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const isElectron = () =>
  typeof window !== "undefined" &&
  (!!window.electronAPI || /electron/i.test(navigator.userAgent));

const isWindows = () =>
  typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent);

/** Sentinel value for "system default" — Radix Select disallows empty string. */
const DEFAULT_MIC_VALUE = "__default__";

type AudioDevice = { deviceId: string; label: string };

export function VoiceApp() {
  usePageTitle("Voice");
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings | null>(
    null,
  );
  const [audioInputs, setAudioInputs] = useState<AudioDevice[]>([]);
  const primaryModifier = getPrimaryModifierLabel();

  useEffect(() => {
    if (!isElectron()) return;
    void window.electronAPI?.getOverlayStatus?.().then((status) => {
      setOverlayVisible(!!status?.visible);
    });
    window.electronAPI?.onOverlayStatusChanged?.((status) => {
      setOverlayVisible(!!status?.visible);
    });
  }, []);

  useEffect(() => {
    if (!isElectron()) return;
    const api = window.electronAPI as
      | {
          getOverlaySettings?: () => Promise<OverlaySettings>;
          onSettingsChanged?: (cb: (s: OverlaySettings) => void) => void;
        }
      | undefined;
    if (!api?.getOverlaySettings) return;
    void api.getOverlaySettings().then(setOverlaySettings);
    api.onSettingsChanged?.(setOverlaySettings);
  }, []);

  useEffect(() => {
    if (!isElectron()) return;
    const load = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          }));
        setAudioInputs(inputs);
      } catch {
        setAudioInputs([]);
      }
    };
    void load();
  }, []);

  const handleMicChange = useCallback(
    (value: string) => {
      const api = window.electronAPI as
        | {
            updateOverlaySettings?: (
              partial: Partial<OverlaySettings>,
            ) => Promise<OverlaySettings>;
          }
        | undefined;
      if (!api?.updateOverlaySettings || !overlaySettings) return;
      const deviceId =
        value === DEFAULT_MIC_VALUE ? null : value;
      void api
        .updateOverlaySettings({
          voice: {
            ...overlaySettings.voice,
            audioInputDeviceId: deviceId,
          },
        })
        .then((updated: OverlaySettings) => setOverlaySettings(updated));
    },
    [overlaySettings],
  );

  const handleOverlayToggle = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.showOverlay || typeof api.showOverlay !== "function") {
      toast.error("Voice overlay is not available in this window. Restart the desktop app.");
      return;
    }
    if (overlayVisible) {
      try {
        await api.hideOverlay?.();
      } catch (e) {
        console.error("[Voice] hideOverlay failed:", e);
        toast.error("Could not close overlay");
      }
      return;
    }
    try {
      setOverlayVisible(true);
      await api.showOverlay();
    } catch (e) {
      console.error("[Voice] showOverlay failed:", e);
      setOverlayVisible(false);
      toast.error("Could not launch voice overlay. Run the desktop app and try again.");
    }
  }, [overlayVisible]);

  const headerActionsNode = useMemo(
    () => (
      <Button onClick={() => void handleOverlayToggle()}>
        {overlayVisible ? "Close active" : "Launch Voice Overlay"}
      </Button>
    ),
    [handleOverlayToggle, overlayVisible],
  );
  const headerActionsPortal = usePageHeaderActions(headerActionsNode);

  if (!isElectron()) {
    return (
      <>
        {headerActionsPortal}
        <div className="flex h-full flex-col overflow-auto py-5">
          <div className="mb-5">
            <p className="text-[12px] text-muted-foreground">
              Voice overlay configuration
            </p>
          </div>
          <div className="max-w-4xl space-y-4">
            <div>
              <h2 className="text-[15px] font-semibold">Desktop app required</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Voice overlay is available in the Basics OS desktop app.
                Download and run the desktop app to use voice commands,
                dictation, and the AI assistant overlay.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const dictationShortcutText = isWindows()
    ? "Press once to start recording, press again to stop and paste into the focused field."
    : "Hold the key to record; release to transcribe and paste into the focused field.";

  return (
    <>
      {headerActionsPortal}
      <div className="flex h-full flex-col overflow-auto py-5">
        <div className="mb-5">
          <p className="text-[12px] text-muted-foreground">
            Configure the floating voice pill and global shortcuts.
          </p>
        </div>

        <div className="max-w-4xl space-y-3">
          {/* Microphone */}
          <div className="rounded-xl bg-card p-6 space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold">Microphone</h3>
              <p className="text-[12px] text-muted-foreground">
                Select the input device for the voice overlay.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voice-mic" className="text-sm font-medium">
                Input device
              </Label>
              <Select
                value={
                  overlaySettings?.voice?.audioInputDeviceId ||
                  DEFAULT_MIC_VALUE
                }
                onValueChange={handleMicChange}
              >
                <SelectTrigger id="voice-mic" className="w-full">
                  <SelectValue placeholder="System default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_MIC_VALUE}>
                    System default
                  </SelectItem>
                  {audioInputs.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="rounded-xl bg-card p-6 space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold">Shortcuts</h3>
              <p className="text-[12px] text-muted-foreground">
                Global keyboard shortcuts to control the overlay.
              </p>
            </div>
            <ul className="space-y-4 text-sm">
              <li className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Kbd>{`${primaryModifier}+Space`}</Kbd>
                  <span className="font-medium">AI Assistant</span>
                </div>
                <span className="text-muted-foreground">Tap to listen, auto-stops after silence.</span>
              </li>
              <li className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Double Tap</span>
                  <Kbd>{`${primaryModifier}+Space`}</Kbd>
                </div>
                <span className="text-muted-foreground">Continuous listening mode.</span>
              </li>
              <li className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Kbd>{`${primaryModifier}+Shift+Space`}</Kbd>
                  <span className="font-medium">Dictation</span>
                </div>
                <span className="text-muted-foreground">{dictationShortcutText}</span>
              </li>
              <li className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Kbd>{`${primaryModifier}+Alt+Space`}</Kbd>
                  <span className="font-medium">Meetings</span>
                </div>
                <span className="text-muted-foreground">Toggle meeting mode (stub).</span>
              </li>
            </ul>
          </div>

          {/* Capabilities */}
          <div className="rounded-xl bg-card p-6 space-y-3">
            <div>
              <h3 className="text-[15px] font-semibold">Capabilities</h3>
              <p className="text-[12px] text-muted-foreground">
                What you can do with the voice assistant.
              </p>
            </div>
            <ul className="grid gap-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>Ask CRM questions (pipeline, deals, contacts)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>Dictation & transcription anywhere</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>Navigate to pages (contacts, settings)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>Create tasks, notes, update deals</span>
              </li>
            </ul>
          </div>

          {/* Requirements */}
          <div className="rounded-xl bg-card p-6 space-y-3">
            <h3 className="text-[15px] font-semibold">Requirements</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Add your <strong>Basics API key</strong> in Settings for transcription, TTS, and AI streaming.
              Optionally, you can configure a custom <strong>Deepgram key</strong> (Settings → AI Configuration → Transcription BYOK)
              to use your own API key for speech-to-text. The overlay authenticates using your active CRM session.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
