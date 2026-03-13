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
  Left: "←",
  Right: "→",
  Up: "↑",
  Down: "↓",
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

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

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

/**
 * Builds a human-readable display string for currently held keys.
 * Shows modifier names + the non-modifier key (if any).
 */
const buildLiveDisplay = (event: KeyboardEvent): string => {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push(isMac() ? "Cmd" : "Win");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  if (!MODIFIER_KEYS.has(event.key)) {
    const token = keyEventToAcceleratorToken(event);
    if (token) parts.push(KEY_DISPLAY[token] ?? token);
  }

  return parts.join("+");
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

/** Key badge pill — matches Discord's style. */
function KeyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.3)] min-w-[1.4rem] leading-none">
      {label}
    </span>
  );
}

/**
 * Shortcut row with inline recording state.
 * When recording, shows live key badges that update as keys are held.
 * Commits on full key release (all keys up) — same feel as Discord keybinds.
 */
function ShortcutRow({
  label,
  description,
  value,
  onRecord,
  isRecording,
  liveKeys,
  onCancel,
}: {
  label: string;
  description: string;
  value: string;
  onRecord: () => void;
  isRecording?: boolean;
  liveKeys?: string;
  onCancel?: () => void;
}) {
  if (isRecording) {
    const keyParts = liveKeys ? liveKeys.split("+").filter(Boolean) : [];

    return (
      <li className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">
            Hold keys, then release to set. <kbd className="text-[10px] opacity-60">Esc</kbd> to cancel.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex min-w-[140px] items-center gap-1 rounded-lg border border-primary bg-primary/5 px-2.5 py-1.5">
            {keyParts.length > 0 ? (
              keyParts.map((k, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-[10px] text-muted-foreground">+</span>
                  )}
                  <KeyBadge label={k} />
                </span>
              ))
            ) : (
              <span className="text-xs text-primary/70 animate-pulse select-none">
                Press keys…
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Cancel"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        onClick={onRecord}
        className="shrink-0 min-w-[100px] rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-mono font-medium text-foreground hover:bg-muted hover:border-primary/50 transition-colors cursor-pointer text-center"
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

  // Discord-style recording state
  const [liveKeys, setLiveKeys] = useState<string>("");
  const heldCodes = useRef<Set<string>>(new Set());
  const committableAccelerator = useRef<string | null>(null);

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

  const cancelRecording = useCallback(() => {
    heldCodes.current.clear();
    committableAccelerator.current = null;
    setLiveKeys("");
    setRecordingSlot(null);
    recordingRef.current = false;
    const api = window.electronAPI as ElectronVoiceApi | undefined;
    void api?.cancelShortcutRecording?.();
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
        await api.cancelShortcutRecording?.();
      }

      // Reset Discord-style tracking state
      heldCodes.current.clear();
      committableAccelerator.current = null;
      setLiveKeys("");

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

  /**
   * Discord-style recording for non-macOS:
   * - keydown  → update live display; store accelerator only when a non-modifier is the final key
   * - keyup    → when ALL keys are released, commit (if a non-modifier was held) or reset
   * - Escape alone → cancel without saving
   */
  useEffect(() => {
    if (!recordingSlot || isMac()) return;
    const api = window.electronAPI as ElectronVoiceApi | undefined;
    const updateOverlaySettings = api?.updateOverlaySettings;
    if (!updateOverlaySettings) {
      setRecordingSlot(null);
      recordingRef.current = false;
      return;
    }

    // Fresh state for this recording session
    heldCodes.current.clear();
    committableAccelerator.current = null;
    setLiveKeys("");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();

      heldCodes.current.add(event.code);

      // Escape alone cancels without saving
      if (event.key === "Escape" && heldCodes.current.size === 1) {
        cancelRecording();
        return;
      }

      // Always update the live display so the user sees what they're holding
      setLiveKeys(buildLiveDisplay(event));

      // Only mark as committable when the triggering key is a real (non-modifier) key
      if (!MODIFIER_KEYS.has(event.key)) {
        const acc = keyEventToAccelerator(event);
        if (acc) committableAccelerator.current = acc;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      heldCodes.current.delete(event.code);

      // All keys released → commit or reset
      if (heldCodes.current.size === 0) {
        const acc = committableAccelerator.current;
        committableAccelerator.current = null;

        if (acc) {
          void updateOverlaySettings(
            buildShortcutUpdate(recordingSlot, overlaySettings, acc),
          )
            .then((updated) => {
              setOverlaySettings(updated);
              toast.success(
                `${recordingSlot} shortcut set to ${formatAccelerator(acc)}`,
              );
            })
            .catch(() => toast.error("Failed to update shortcut"))
            .finally(() => {
              setRecordingSlot(null);
              recordingRef.current = false;
            });
        } else {
          // Only modifiers were pressed — stay in recording mode, reset display
          setLiveKeys("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      heldCodes.current.clear();
    };
  }, [overlaySettings, recordingSlot, cancelRecording]);

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
                Click a shortcut, hold your keys, then release to save.
              </p>
            </div>

            <ul className="space-y-3">
              <ShortcutRow
                label="Dictation"
                description={
                  isMac()
                    ? "Hold to dictate + paste. Double-tap for continuous."
                    : "Tap to toggle dictation. Tap again to stop."
                }
                value={getShortcutDisplayValue("dictation", overlaySettings)}
                onRecord={() => void handleRecordShortcut("dictation")}
                isRecording={recordingSlot === "dictation"}
                liveKeys={liveKeys}
                onCancel={cancelRecording}
              />
              <ShortcutRow
                label="AI Assistant"
                description={
                  isMac()
                    ? "Tap for AI. Hold for manual control. Double-tap for continuous."
                    : "Tap to toggle AI assistant. Double-tap for continuous."
                }
                value={getShortcutDisplayValue("assistant", overlaySettings)}
                onRecord={() => void handleRecordShortcut("assistant")}
                isRecording={recordingSlot === "assistant"}
                liveKeys={liveKeys}
                onCancel={cancelRecording}
              />
              <ShortcutRow
                label="Meeting"
                description="Toggle meeting recording."
                value={getShortcutDisplayValue("meeting", overlaySettings)}
                onRecord={() => void handleRecordShortcut("meeting")}
                isRecording={recordingSlot === "meeting"}
                liveKeys={liveKeys}
                onCancel={cancelRecording}
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
              Add your <strong>Basics API key</strong> in Settings for Voice Pill to work.
              (transcription, STT, and AI features). Optionally, you can
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
