// ---------------------------------------------------------------------------
// Global shortcut manager — double-tap detection on both shortcuts
// ---------------------------------------------------------------------------

import { globalShortcut } from "electron";

export type ShortcutCallbacks = {
  onAssistantPress: () => void;
  onAssistantDoubleTap: () => void;
  onDictationPress: () => void;
  onDictationDoubleTap: () => void;
};

export type ShortcutManager = {
  registerAll: (assistantKey: string, dictationKey: string, doubleTapMs: number) => void;
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
  const registerAll = (assistantKey: string, dictationKey: string, doubleTapMs: number): void => {
    unregisterAll();

    const handleAssistant = createDoubleTapDetector(
      doubleTapMs,
      callbacks.onAssistantPress,
      callbacks.onAssistantDoubleTap,
    );

    const handleDictation = createDoubleTapDetector(
      doubleTapMs,
      callbacks.onDictationPress,
      callbacks.onDictationDoubleTap,
    );

    const assistantOk = globalShortcut.register(assistantKey, handleAssistant);
    if (!assistantOk) {
      console.warn(`[shortcuts] Failed to register assistant shortcut: ${assistantKey}`);
    }

    const dictationOk = globalShortcut.register(dictationKey, handleDictation);
    if (!dictationOk) {
      console.warn(`[shortcuts] Failed to register dictation shortcut: ${dictationKey}`);
    }
  };

  const unregisterAll = (): void => {
    globalShortcut.unregisterAll();
  };

  return { registerAll, unregisterAll };
};
