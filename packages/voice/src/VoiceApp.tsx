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
    assistantToggle: string;
    dictationToggle: string;
    dictationHoldKey: string;
    meetingToggle: string;
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

type ShortcutSlot = "dictation" | "assistant" | "meeting";

type ElectronVoiceApi = {
  getOverlayStatus?: () => Promise<{ visible: boolean; active: boolean }>;
  onOverlayStatusChanged?: (
    cb: (status: { visible: boolean; active: boolean }) => void,
  ) => void;
  getOverlaySettings?: () => Promise<OverlaySettings>;
  onSettingsChanged?: (cb: (s: OverlaySettings) => void) => void;
  updateOverlaySettings?: (
    partial: Partial<OverlaySettings>,
  ) => Promise<OverlaySettings>;
  startShortcutRecording?: () => Promise<ShortcutBinding | null>;
  cancelShortcutRecording?: () => Promise<void>;
  showOverlay?: () => Promise<void>;
  hideOverlay?: () => Promise<void>;
};

const NON_MAC_SHORTCUT_FIELDS: Record<
  ShortcutSlot,
  "assistantToggle" | "dictationHoldKey" | "meetingToggle"
> = {
  dictation: "dictationHoldKey",
  assistant: "assistantToggle",
  meeting: "meetingToggle",
};

const isMac = () =>
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

const MODIFIER_DISPLAY: Record<string, string> = {
  CommandOrControl: isWindows() ? "Ctrl" : "Cmd",
  Control: "Ctrl",
  Ctrl: "Ctrl",
  Command: "Cmd",
  Alt: "Alt",
  Option: isWindows() ? "Alt" : "Option",
  Shift: "Shift",
  Super: isWindows() ? "Win" : "Super",
  Meta: isWindows() ? "Win" : "Meta",
};

const KEY_DISPLAY: Record<string, string> = {
  Space: "Space",
  Return: "Enter",
  Enter: "Enter",
  Esc: "Esc",
  Escape: "Esc",
  Left: "Left",
  Right: "Right",
  Up: "Up",
  Down: "Down",
  Plus: "+",
};

const SPECIAL_KEY_TOKENS: Record<string, string> = {
  " ": "Space",
  Spacebar: "Space",
  Escape: "Esc",
  Esc: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  CapsLock: "CapsLock",
  NumLock: "Numlock",
  ScrollLock: "ScrollLock",
  PrintScreen: "PrintScreen",
  Pause: "Pause",
  ContextMenu: "Menu",
  "-": "-",
  "=": "=",
  ",": ",",
  ".": ".",
  "/": "/",
  ";": ";",
  "'": "'",
  "[": "[",
  "]": "]",
  "\\": "\\",
  "`": "`",
};

const formatAccelerator = (accelerator?: string | null): string => {
  if (!accelerator) return "Not set";
  return accelerator
    .split("+")
    .filter(Boolean)
    .map((part) => MODIFIER_DISPLAY[part] ?? KEY_DISPLAY[part] ?? part)
    .join(" + ");
};

const getShortcutDisplayValue = (
  slot: ShortcutSlot,
  settings: OverlaySettings | null,
): string => {
  if (!settings) return "Not set";
  if (isMac()) {
    return settings.shortcuts[slot]?.label ?? "Not set";
  }
  const field = NON_MAC_SHORTCUT_FIELDS[slot];
  return formatAccelerator(settings.shortcuts[field]);
};

const buildShortcutUpdate = (
  slot: ShortcutSlot,
  settings: OverlaySettings | null,
  value: string,
): Partial<OverlaySettings> => {
  const shortcuts: OverlaySettings["shortcuts"] = {
    assistantToggle: settings?.shortcuts.assistantToggle ?? "",
    dictationToggle: settings?.shortcuts.dictationToggle ?? "",
    dictationHoldKey: settings?.shortcuts.dictationHoldKey ?? "",
    meetingToggle: settings?.shortcuts.meetingToggle ?? "",
    ...(settings?.shortcuts ?? {}),
  };
  if (slot === "dictation") {
    shortcuts.dictationHoldKey = value;
    shortcuts.dictationToggle = value;
  } else if (slot === "assistant") {
    shortcuts.assistantToggle = value;
  } else {
    shortcuts.meetingToggle = value;
  }
  return { shortcuts };
};

const keyEventToAcceleratorToken = (event: KeyboardEvent): string | null => {
  const key = event.key;

  if (key === "Control") return "Control";
  if (key === "Shift") return "Shift";
  if (key === "Alt") return "Alt";
  if (key === "Meta") return isMac() ? "Command" : "Super";

  if (/^[a-z0-9]$/i.test(key)) return key.toUpperCase();
  if (/^F\d{1,2}$/i.test(key)) return key.toUpperCase();

  return SPECIAL_KEY_TOKENS[key] ?? null;
};

const keyEventToAccelerator = (event: KeyboardEvent): string | null => {
  const token = keyEventToAcceleratorToken(event);
  if (!token) return null;

  const parts: string[] = [];
  if (event.ctrlKey && token !== "Control") parts.push("Control");
  if (event.altKey && token !== "Alt") parts.push("Alt");
  if (event.shiftKey && token !== "Shift") parts.push("Shift");
  if (event.metaKey && token !== "Command" && token !== "Super") {
    parts.push(isMac() ? "Command" : "Super");
  }
  parts.push(token);

  return parts.join("+");
};

/** Interactive shortcut row — click to record a new key binding. */
function ShortcutRow({
  label,
  description,
  value,
  onRecord,
}: {
  label: string;
  description: string;
  value: string;
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
        {value}
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
  const [recordingSlot, setRecordingSlot] = useState<ShortcutSlot | null>(null);
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
    const api = window.electronAPI as ElectronVoiceApi | undefined;
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
      const api = window.electronAPI as ElectronVoiceApi | undefined;
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
    async (slot: ShortcutSlot) => {
      const api = window.electronAPI as ElectronVoiceApi | undefined;
      if (!api?.updateOverlaySettings) return;

      if (recordingRef.current) {
        // Cancel any existing recording
        await api.cancelShortcutRecording?.();
      }

      setRecordingSlot(slot);
      recordingRef.current = true;

      if (!isMac()) return;
      if (!api.startShortcutRecording) {
        setRecordingSlot(null);
        recordingRef.current = false;
        return;
      }

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

  useEffect(() => {
    if (!recordingSlot || isMac()) return;
    const api = window.electronAPI as ElectronVoiceApi | undefined;
    const updateOverlaySettings = api?.updateOverlaySettings;
    if (!updateOverlaySettings) {
      setRecordingSlot(null);
      recordingRef.current = false;
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setRecordingSlot(null);
        recordingRef.current = false;
        return;
      }

      const accelerator = keyEventToAccelerator(event);
      if (!accelerator) return;

      void updateOverlaySettings(
        buildShortcutUpdate(recordingSlot, overlaySettings, accelerator),
      )
        .then((updated) => {
          setOverlaySettings(updated);
          toast.success(
            `${recordingSlot} shortcut set to ${formatAccelerator(accelerator)}`,
          );
        })
        .catch(() => {
          toast.error("Failed to update shortcut");
        })
        .finally(() => {
          setRecordingSlot(null);
          recordingRef.current = false;
        });
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [overlaySettings, recordingSlot]);

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
                value={getShortcutDisplayValue("dictation", overlaySettings)}
                onRecord={() => void handleRecordShortcut("dictation")}
              />
              <ShortcutRow
                label="AI Assistant"
                description="Tap for AI. Hold for manual control. Double-tap for continuous."
                value={getShortcutDisplayValue("assistant", overlaySettings)}
                onRecord={() => void handleRecordShortcut("assistant")}
              />
              <ShortcutRow
                label="Meeting"
                description="Toggle meeting recording."
                value={getShortcutDisplayValue("meeting", overlaySettings)}
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
