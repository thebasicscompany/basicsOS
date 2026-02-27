// ---------------------------------------------------------------------------
// Global shortcut manager — double-tap detection on assistant shortcut only
// Dictation is now handled by hold-key-detector via uiohook-napi.
// ---------------------------------------------------------------------------

import { globalShortcut } from "electron";
import { createDesktopLogger } from "../shared/logger.js";

const log = createDesktopLogger("shortcuts");

export type ShortcutCallbacks = {
  onAssistantPress: () => void;
  onAssistantDoubleTap: () => void;
};

export type ShortcutManager = {
  registerAll: (assistantKey: string, doubleTapMs: number) => void;
  unregisterAll: () => void;
};

const createDoubleTapDetector = (
  doubleTapMs: number,
  onSingle: () => void,
  onDouble: () => void,
): (() => void) => {
  let lastTap = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return () => {
    const now = Date.now();
    const elapsed = now - lastTap;
    lastTap = now;

    if (elapsed < doubleTapMs && timer) {
      clearTimeout(timer);
      timer = null;
      onDouble();
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onSingle();
      }, doubleTapMs);
    }
  };
};

export const createShortcutManager = (callbacks: ShortcutCallbacks): ShortcutManager => {
  const registerAll = (assistantKey: string, doubleTapMs: number): void => {
    unregisterAll();

    const handleAssistant = createDoubleTapDetector(
      doubleTapMs,
      () => callbacks.onAssistantPress(),
      () => callbacks.onAssistantDoubleTap(),
    );

    const ok = globalShortcut.register(assistantKey, handleAssistant);
    if (!ok) {
      log.warn(`Failed to register assistant shortcut: ${assistantKey}`);
    }
  };

  const unregisterAll = (): void => {
    globalShortcut.unregisterAll();
  };

  return { registerAll, unregisterAll };
};
