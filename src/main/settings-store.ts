import { app } from "electron";
import fs from "fs";
import path from "path";
import type { OverlaySettings, ShortcutBinding } from "@/shared-overlay/types.js";
import { createDesktopLogger } from "@/shared-overlay/logger.js";

const log = createDesktopLogger("settings");

/** Native key bindings (macOS CGEventTap keycodes + flags) */
const DEFAULT_NATIVE_BINDINGS: Record<string, ShortcutBinding> = {
  dictation: { keyCode: 63, modifiers: 0, label: "Fn" },
  assistant: { keyCode: 49, modifiers: 0x100000, label: "⌘Space" },
  meeting: { keyCode: 49, modifiers: 0x180000, label: "⌥⌘Space" },
};

const DEFAULT_SHORTCUTS: OverlaySettings["shortcuts"] = {
  // Native bindings
  dictation: DEFAULT_NATIVE_BINDINGS.dictation,
  assistant: DEFAULT_NATIVE_BINDINGS.assistant,
  meeting: DEFAULT_NATIVE_BINDINGS.meeting,
  // Legacy accelerator strings (fallback for non-macOS)
  assistantToggle: "CommandOrControl+Space",
  dictationToggle: "CommandOrControl+Shift+Space",
  dictationHoldKey: "CommandOrControl+Shift+Space",
  meetingToggle: "CommandOrControl+Alt+Space",
  recordScreenToggle: "CommandOrControl+Alt+R",
};

export const OVERLAY_DEFAULTS: OverlaySettings = {
  shortcuts: DEFAULT_SHORTCUTS,
  voice: {
    language: "en-US",
    silenceTimeoutMs: 3000,
    ttsEnabled: false,
    ttsRate: 1.05,
    audioInputDeviceId: null as string | null,
  },
  behavior: {
    doubleTapWindowMs: 400,
    autoDismissMs: 5000,
    showDictationPreview: true,
    holdThresholdMs: 150,
  },
  meeting: {
    autoDetect: false,
    chunkIntervalMs: 5000,
  },
};

const getSettingsPath = (): string =>
  path.join(app.getPath("userData"), "basicsos-overlay-settings.json");

const normalizeLegacyShortcuts = (
  shortcuts?: Partial<OverlaySettings["shortcuts"]>,
): Partial<OverlaySettings["shortcuts"]> | undefined => {
  if (!shortcuts) return shortcuts;

  // Migrate the old Option/Alt-based defaults to the cross-platform shortcuts.
  const normalized = { ...shortcuts };
  if (normalized.assistantToggle === "Option+Space") {
    normalized.assistantToggle = DEFAULT_SHORTCUTS.assistantToggle;
  }
  if (normalized.dictationToggle === "Option+Shift+Space") {
    normalized.dictationToggle = DEFAULT_SHORTCUTS.dictationToggle;
  }
  if (normalized.dictationHoldKey === "Option+Shift+Space") {
    normalized.dictationHoldKey = DEFAULT_SHORTCUTS.dictationHoldKey;
  }
  if (normalized.meetingToggle === "Option+CommandOrControl+Space") {
    normalized.meetingToggle = DEFAULT_SHORTCUTS.meetingToggle;
  }

  return normalized;
};

export const getOverlaySettings = (): OverlaySettings => {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<OverlaySettings>;
    const shortcuts = normalizeLegacyShortcuts(parsed.shortcuts);
    return {
      shortcuts: { ...OVERLAY_DEFAULTS.shortcuts, ...shortcuts },
      voice: {
        ...OVERLAY_DEFAULTS.voice,
        ...parsed.voice,
        audioInputDeviceId:
          parsed.voice?.audioInputDeviceId ??
          OVERLAY_DEFAULTS.voice.audioInputDeviceId,
      },
      behavior: { ...OVERLAY_DEFAULTS.behavior, ...parsed.behavior },
      meeting: { ...OVERLAY_DEFAULTS.meeting, ...parsed.meeting },
    };
  } catch {
    return OVERLAY_DEFAULTS;
  }
};

export const setOverlaySettings = (
  partial: Partial<OverlaySettings>,
): OverlaySettings => {
  const current = getOverlaySettings();
  const merged: OverlaySettings = {
    shortcuts: {
      ...current.shortcuts,
      ...partial.shortcuts,
      recordScreenToggle:
        partial.shortcuts?.recordScreenToggle ??
        current.shortcuts.recordScreenToggle ??
        DEFAULT_SHORTCUTS.recordScreenToggle,
    },
    voice: { ...current.voice, ...partial.voice },
    behavior: { ...current.behavior, ...partial.behavior },
    meeting: { ...current.meeting, ...partial.meeting },
  };
  try {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify(merged, null, 2),
      "utf8",
    );
  } catch (err) {
    log.error("Failed to write settings:", err);
  }
  return merged;
};
