import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ShortcutBinding } from "@/shared-overlay/types";

export type ShortcutSlot = "dictation" | "assistant" | "meeting";

export type OverlaySettings = {
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

type ElectronShortcutApi = {
  getOverlaySettings?: () => Promise<OverlaySettings>;
  onSettingsChanged?: (cb: (s: OverlaySettings) => void) => void;
  updateOverlaySettings?: (partial: Partial<OverlaySettings>) => Promise<OverlaySettings>;
  startShortcutRecording?: () => Promise<ShortcutBinding | null>;
  cancelShortcutRecording?: () => Promise<void>;
  checkKeyMonitorStatus?: () => Promise<boolean>;
  promptAccessibility?: () => Promise<boolean>;
  restartKeyMonitor?: () => Promise<boolean>;
};

export const NON_MAC_SHORTCUT_FIELDS: Record<
  ShortcutSlot,
  "assistantToggle" | "dictationHoldKey" | "meetingToggle"
> = {
  dictation: "dictationHoldKey",
  assistant: "assistantToggle",
  meeting: "meetingToggle",
};

export const isMac = () =>
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

const isWindows = () =>
  typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent);

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

export const formatAccelerator = (accelerator?: string | null): string => {
  if (!accelerator) return "Not set";
  return accelerator
    .split("+")
    .filter(Boolean)
    .map((part) => MODIFIER_DISPLAY[part] ?? KEY_DISPLAY[part] ?? part)
    .join(" + ");
};

// Mirrors keyboard-hook.ts MAC_KEYCODE_LABELS so the renderer can display
// a clean label even if the stored ShortcutBinding.label is stale/raw.
const MAC_KEYCODE_LABELS: Record<number, string> = {
  55: "⌘", 54: "Right ⌘", 56: "⇧", 60: "Right ⇧",
  58: "⌥", 61: "Right ⌥", 59: "⌃", 62: "Right ⌃",
  63: "Fn", 57: "⇪", 49: "Space", 36: "↩", 48: "⇥",
  51: "⌫", 53: "⎋", 76: "⌤",
  123: "←", 124: "→", 125: "↓", 126: "↑",
  122: "F1", 120: "F2", 99: "F3", 118: "F4", 96: "F5", 97: "F6",
  98: "F7", 100: "F8", 101: "F9", 109: "F10", 103: "F11", 111: "F12",
};
const MOD_FN = 0x800000;
const MOD_CONTROL = 0x040000;
const MOD_OPTION = 0x080000;
const MOD_SHIFT = 0x020000;
const MOD_COMMAND = 0x100000;
const MODIFIER_KEYCODES = new Set([55, 54, 56, 60, 58, 61, 59, 62, 63, 57]);

function deriveMacLabel(binding: ShortcutBinding): string {
  const parts: string[] = [];
  if (binding.modifiers & MOD_FN) parts.push("Fn");
  if (binding.modifiers & MOD_CONTROL) parts.push("⌃");
  if (binding.modifiers & MOD_OPTION) parts.push("⌥");
  if (binding.modifiers & MOD_SHIFT) parts.push("⇧");
  if (binding.modifiers & MOD_COMMAND) parts.push("⌘");
  const keyLabel = MAC_KEYCODE_LABELS[binding.keyCode];
  if (keyLabel && !MODIFIER_KEYCODES.has(binding.keyCode)) {
    parts.push(keyLabel);
  } else if (keyLabel) {
    if (parts.length === 0) parts.push(keyLabel);
  }
  return parts.join("") || binding.label;
}

export const getShortcutDisplayValue = (
  slot: ShortcutSlot,
  settings: OverlaySettings | null,
): string => {
  if (!settings) return "Not set";
  if (isMac()) {
    const binding = settings.shortcuts[slot];
    if (!binding) return "Not set";
    // Re-derive from keyCode+modifiers to avoid stale/raw label like "Key63"
    const derived = deriveMacLabel(binding);
    return derived || binding.label || "Not set";
  }
  const field = NON_MAC_SHORTCUT_FIELDS[slot];
  return formatAccelerator(settings.shortcuts[field]);
};

export const buildShortcutUpdate = (
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

export type UseShortcutRecordingReturn = {
  overlaySettings: OverlaySettings | null;
  recordingSlot: ShortcutSlot | null;
  liveKeys: string;
  handleRecordShortcut: (slot: ShortcutSlot) => Promise<void>;
  cancelRecording: () => void;
};

/**
 * Encapsulates the Discord-style shortcut recording logic.
 * Works on both macOS (native CGEventTap via Electron IPC) and Windows/Linux (keyboard events).
 */
export function useShortcutRecording(): UseShortcutRecordingReturn {
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings | null>(null);
  const [recordingSlot, setRecordingSlot] = useState<ShortcutSlot | null>(null);
  const [liveKeys, setLiveKeys] = useState<string>("");
  const recordingRef = useRef(false);
  const heldCodes = useRef<Set<string>>(new Set());
  const committableAccelerator = useRef<string | null>(null);

  useEffect(() => {
    const api = window.electronAPI as ElectronShortcutApi | undefined;
    if (!api?.getOverlaySettings) return;
    void api.getOverlaySettings().then(setOverlaySettings);
    api.onSettingsChanged?.(setOverlaySettings);
  }, []);

  const cancelRecording = useCallback(() => {
    heldCodes.current.clear();
    committableAccelerator.current = null;
    setLiveKeys("");
    setRecordingSlot(null);
    recordingRef.current = false;
    const api = window.electronAPI as ElectronShortcutApi | undefined;
    void api?.cancelShortcutRecording?.();
  }, []);

  const handleRecordShortcut = useCallback(
    async (slot: ShortcutSlot) => {
      const api = window.electronAPI as ElectronShortcutApi | undefined;
      if (!api?.updateOverlaySettings) return;
      if (recordingRef.current) await api.cancelShortcutRecording?.();

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

      const monitorRunning = await api.checkKeyMonitorStatus?.();
      if (!monitorRunning) {
        setRecordingSlot(null);
        recordingRef.current = false;
        toast.error(
          "Accessibility permission required. Enable it in System Settings → Privacy & Security → Accessibility, then try again.",
        );
        await api.promptAccessibility?.();
        const nowRunning = await api.restartKeyMonitor?.();
        if (nowRunning) {
          toast.success("Accessibility enabled — you can now configure shortcuts.");
        }
        return;
      }

      try {
        const binding = await api.startShortcutRecording();
        if (!binding) return;
        const updated = await api.updateOverlaySettings({
          shortcuts: { ...overlaySettings?.shortcuts, [slot]: binding },
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

  // Discord-style key recording for non-macOS
  useEffect(() => {
    if (!recordingSlot || isMac()) return;
    const api = window.electronAPI as ElectronShortcutApi | undefined;
    const updateOverlaySettings = api?.updateOverlaySettings;
    if (!updateOverlaySettings) {
      setRecordingSlot(null);
      recordingRef.current = false;
      return;
    }

    heldCodes.current.clear();
    committableAccelerator.current = null;
    setLiveKeys("");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      heldCodes.current.add(event.code);

      if (event.key === "Escape" && heldCodes.current.size === 1) {
        cancelRecording();
        return;
      }

      setLiveKeys(buildLiveDisplay(event));

      if (!MODIFIER_KEYS.has(event.key)) {
        const acc = keyEventToAccelerator(event);
        if (acc) committableAccelerator.current = acc;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      heldCodes.current.delete(event.code);

      if (heldCodes.current.size === 0) {
        const acc = committableAccelerator.current;
        committableAccelerator.current = null;

        if (acc) {
          void updateOverlaySettings(buildShortcutUpdate(recordingSlot, overlaySettings, acc))
            .then((updated) => {
              setOverlaySettings(updated);
              toast.success(`${recordingSlot} shortcut set to ${formatAccelerator(acc)}`);
            })
            .catch(() => toast.error("Failed to update shortcut"))
            .finally(() => {
              setRecordingSlot(null);
              recordingRef.current = false;
            });
        } else {
          setLiveKeys("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    const heldCodesRef = heldCodes.current;
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      heldCodesRef.clear();
    };
  }, [overlaySettings, recordingSlot, cancelRecording]);

  return { overlaySettings, recordingSlot, liveKeys, handleRecordShortcut, cancelRecording };
}
