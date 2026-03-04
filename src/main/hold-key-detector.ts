// Hold-to-talk detector — uses uiohook-napi when available (macOS/Linux).
// Stub implementation: hold-to-talk disabled to avoid native deps on Windows.
// To enable: add uiohook-napi dep and implement with uiohook.keyDown/keyUp.

import { createDesktopLogger } from "../shared-overlay/logger.js";

const log = createDesktopLogger("hold-key");

export type HoldKeyConfig = {
  accelerator: string;
  holdThresholdMs: number;
};

export type HoldKeyCallbacks = {
  onHoldStart: () => void;
  onHoldEnd: () => void;
};

export type HoldKeyDetector = {
  start: () => void;
  stop: () => void;
  updateConfig: (config: Partial<HoldKeyConfig>) => void;
};

const noopDetector: HoldKeyDetector = {
  start: () => log.debug("Hold-key detector disabled (stub)"),
  stop: () => {},
  updateConfig: () => {},
};

export const createHoldKeyDetector = (
  _config: HoldKeyConfig,
  _callbacks: HoldKeyCallbacks
): HoldKeyDetector => {
  return noopDetector;
};
