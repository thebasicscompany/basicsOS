import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import {
  usePageTitle,
  usePageHeaderActions,
} from "basics-os/src/contexts/page-header";
import { Button } from "basics-os/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "basics-os/src/components/ui/select";
import { Label } from "basics-os/src/components/ui/label";
import { toast } from "sonner";
import type { ShortcutBinding } from "basics-os/src/shared-overlay/types";

/** Shape of overlay settings used for microphone selection (matches shared-overlay types). */
type OverlaySettings = {
  shortcuts: {
    dictation?: ShortcutBinding;
    assistant?: ShortcutBinding;
    meeting?: ShortcutBinding;
    [key: string]: unknown;
  };
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

/** Interactive shortcut row — click to record a new key binding. */
function ShortcutRow({
  label,
  description,
  binding,
  onRecord,
}: {
  label: string;
  description: string;
  binding: ShortcutBinding | undefined;
  onRecord: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        onClick={onRecord}
        className="shrink-0 min-w-[100px] rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-mono font-medium text-foreground hover:bg-muted transition-colors cursor-pointer text-center"
        title="Click to change shortcut"
      >
        {binding?.label ?? "Not set"}
      </button>
    </li>
  );
}

export function VoiceApp() {
  usePageTitle("Voice");
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlaySettings, setOverlaySettings] =
    useState<OverlaySettings | null>(null);
  const [audioInputs, setAudioInputs] = useState<AudioDevice[]>([]);
  const [recordingSlot, setRecordingSlot] = useState<string | null>(null);
  const recordingRef = useRef(false);

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
      const deviceId = value === DEFAULT_MIC_VALUE ? null : value;
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

  const handleRecordShortcut = useCallback(
    async (slot: "dictation" | "assistant" | "meeting") => {
      const api = window.electronAPI as
        | {
            startShortcutRecording?: () => Promise<ShortcutBinding | null>;
            cancelShortcutRecording?: () => Promise<void>;
            updateOverlaySettings?: (
              partial: Partial<OverlaySettings>,
            ) => Promise<OverlaySettings>;
          }
        | undefined;
      if (!api?.startShortcutRecording || !api?.updateOverlaySettings) return;

      if (recordingRef.current) {
        // Cancel any existing recording
        await api.cancelShortcutRecording?.();
      }

      setRecordingSlot(slot);
      recordingRef.current = true;

      try {
        const binding = await api.startShortcutRecording();
        if (!binding) return;

        const updated = await api.updateOverlaySettings({
          shortcuts: {
            ...overlaySettings?.shortcuts,
            [slot]: binding,
          },
        } as Partial<OverlaySettings>);
        setOverlaySettings(updated);
        toast.success(`${slot} shortcut set to ${binding.label}`);
      } catch {
        toast.error("Failed to record shortcut");
      } finally {
        setRecordingSlot(null);
        recordingRef.current = false;
      }
    },
    [overlaySettings],
  );

  const handleOverlayToggle = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.showOverlay || typeof api.showOverlay !== "function") {
      toast.error(
        "Voice overlay is not available in this window. Restart the desktop app.",
      );
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
      toast.error(
        "Could not launch voice overlay. Run the desktop app and try again.",
      );
    }
  }, [overlayVisible]);

  const headerActionsNode = useMemo(
    () =>
      isElectron() ? (
        <Button onClick={() => void handleOverlayToggle()}>
          {overlayVisible ? "Close active" : "Launch Voice Overlay"}
        </Button>
      ) : null,
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
              <h2 className="text-[15px] font-semibold">
                Desktop app required
              </h2>
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
                Click a shortcut to change it. Press any key or key combo.
              </p>
            </div>

            {recordingSlot && (
              <div className="rounded-lg border border-primary/50 bg-primary/5 px-4 py-3 text-sm text-primary animate-pulse">
                Press any key or key combo for{" "}
                <strong>{recordingSlot}</strong>...
                <button
                  type="button"
                  onClick={() => {
                    void (window.electronAPI as { cancelShortcutRecording?: () => Promise<void> })?.cancelShortcutRecording?.();
                    setRecordingSlot(null);
                    recordingRef.current = false;
                  }}
                  className="ml-2 underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            <ul className="space-y-3">
              <ShortcutRow
                label="Dictation"
                description="Hold to dictate + paste. Double-tap for continuous."
                binding={overlaySettings?.shortcuts?.dictation as ShortcutBinding | undefined}
                onRecord={() => void handleRecordShortcut("dictation")}
              />
              <ShortcutRow
                label="AI Assistant"
                description="Tap for AI. Hold for manual control. Double-tap for continuous."
                binding={overlaySettings?.shortcuts?.assistant as ShortcutBinding | undefined}
                onRecord={() => void handleRecordShortcut("assistant")}
              />
              <ShortcutRow
                label="Meeting"
                description="Toggle meeting recording."
                binding={overlaySettings?.shortcuts?.meeting as ShortcutBinding | undefined}
                onRecord={() => void handleRecordShortcut("meeting")}
              />
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
              Add your <strong>Basics API key</strong> in Settings for
              transcription, TTS, and AI streaming. Optionally, you can
              configure a custom <strong>Deepgram key</strong> (Settings → AI
              Configuration → Transcription BYOK) to use your own API key for
              speech-to-text. The overlay authenticates using your active CRM
              session.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
