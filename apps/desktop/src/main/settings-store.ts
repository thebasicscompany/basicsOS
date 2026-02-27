// ---------------------------------------------------------------------------
// Persistent overlay settings — plain JSON file (no external deps)
// ---------------------------------------------------------------------------

import { app } from "electron";
import fs from "fs";
import path from "path";
import type { OverlaySettings } from "../shared/types.js";
import { createDesktopLogger } from "../shared/logger.js";

export type { OverlaySettings } from "../shared/types.js";

const log = createDesktopLogger("settings");

export const OVERLAY_DEFAULTS: OverlaySettings = {
  shortcuts: {
    assistantToggle: "CommandOrControl+Space",
    dictationToggle: "CommandOrControl+Shift+Space",
    dictationHoldKey: "CommandOrControl+Shift+Space",
    meetingToggle: "CommandOrControl+Alt+Space",
  },
  voice: {
    language: "en-US",
    silenceTimeoutMs: 2000,
    ttsEnabled: true,
    ttsRate: 1.05,
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
  path.join(app.getPath("userData"), "basicos-overlay-settings.json");

export const getOverlaySettings = (): OverlaySettings => {
  try {
    const raw = fs.readFileSync(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<OverlaySettings>;
    return {
      shortcuts: { ...OVERLAY_DEFAULTS.shortcuts, ...parsed.shortcuts },
      voice: { ...OVERLAY_DEFAULTS.voice, ...parsed.voice },
      behavior: { ...OVERLAY_DEFAULTS.behavior, ...parsed.behavior },
      meeting: { ...OVERLAY_DEFAULTS.meeting, ...parsed.meeting },
    };
  } catch {
    return OVERLAY_DEFAULTS;
  }
};

export const setOverlaySettings = (partial: Partial<OverlaySettings>): OverlaySettings => {
  const current = getOverlaySettings();
  const merged: OverlaySettings = {
    shortcuts: { ...current.shortcuts, ...partial.shortcuts },
    voice: { ...current.voice, ...partial.voice },
    behavior: { ...current.behavior, ...partial.behavior },
    meeting: { ...current.meeting, ...partial.meeting },
  };
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), "utf8");
  } catch (err) {
    log.error("Failed to write settings:", err);
  }
  return merged;
};
