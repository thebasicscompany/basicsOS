/**
 * Comprehensive keyboard hook using a native Swift CGEventTap helper.
 *
 * Supports:
 * - Hold-to-talk: keyDown > threshold → onHoldStart; keyUp → onHoldEnd
 * - Double-tap: two quick presses → onDoubleTap
 * - Single-tap: one press, no follow-up → onSingleTap
 * - Single modifier keys (Fn, Ctrl alone, etc.)
 * - Arbitrary key combos (Cmd+Space, Ctrl+Shift+A, etc.)
 * - Shortcut recording for settings UI
 *
 * macOS only — falls back gracefully on other platforms.
 */

import { spawn, execSync, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { app } from "electron";
import { createDesktopLogger } from "@/shared-overlay/logger.js";

const log = createDesktopLogger("keyboard-hook");

// ── macOS virtual keycodes → human-readable labels ──────────────────────

const MAC_KEYCODE_LABELS: Record<number, string> = {
  // Modifiers
  55: "⌘",
  54: "Right ⌘",
  56: "⇧",
  60: "Right ⇧",
  58: "⌥",
  61: "Right ⌥",
  59: "⌃",
  62: "Right ⌃",
  63: "Fn",
  57: "⇪",
  // Common
  49: "Space",
  36: "↩",
  48: "⇥",
  51: "⌫",
  53: "⎋",
  76: "⌤", // Numpad Enter
  // Arrows
  123: "←",
  124: "→",
  125: "↓",
  126: "↑",
  // Function keys
  122: "F1",
  120: "F2",
  99: "F3",
  118: "F4",
  96: "F5",
  97: "F6",
  98: "F7",
  100: "F8",
  101: "F9",
  109: "F10",
  103: "F11",
  111: "F12",
  105: "F13",
  107: "F14",
  113: "F15",
  // Letters
  0: "A",
  11: "B",
  8: "C",
  2: "D",
  14: "E",
  3: "F",
  5: "G",
  4: "H",
  34: "I",
  38: "J",
  40: "K",
  37: "L",
  46: "M",
  45: "N",
  31: "O",
  35: "P",
  12: "Q",
  15: "R",
  1: "S",
  17: "T",
  32: "U",
  9: "V",
  13: "W",
  7: "X",
  16: "Y",
  6: "Z",
  // Numbers
  29: "0",
  18: "1",
  19: "2",
  20: "3",
  21: "4",
  23: "5",
  22: "6",
  26: "7",
  28: "8",
  25: "9",
  // Punctuation
  33: "[",
  30: "]",
  39: "'",
  50: "`",
  27: "-",
  24: "=",
  41: ";",
  43: ",",
  47: ".",
  44: "/",
  42: "\\",
};

// ── Modifier flag constants (macOS CGEventFlags) ────────────────────────

export const MOD_CAPSLOCK = 0x010000;
export const MOD_SHIFT = 0x020000;
export const MOD_CONTROL = 0x040000;
export const MOD_OPTION = 0x080000;
export const MOD_COMMAND = 0x100000;
export const MOD_FN = 0x800000;
/** Mask covering all modifier flags we care about */
const MOD_MASK =
  MOD_SHIFT | MOD_CONTROL | MOD_OPTION | MOD_COMMAND | MOD_FN;

/** Modifier keycodes (macOS virtual keycodes) */
const MODIFIER_KEYCODES = new Set([55, 54, 56, 60, 58, 61, 59, 62, 63, 57]);

/** Map modifier keycode → its flag bit */
const KEYCODE_TO_FLAG: Record<number, number> = {
  55: MOD_COMMAND,
  54: MOD_COMMAND,
  56: MOD_SHIFT,
  60: MOD_SHIFT,
  58: MOD_OPTION,
  61: MOD_OPTION,
  59: MOD_CONTROL,
  62: MOD_CONTROL,
  63: MOD_FN,
  57: MOD_CAPSLOCK,
};

// ── Types ───────────────────────────────────────────────────────────────

export type ShortcutBinding = {
  /** macOS virtual keycode (e.g., 63 for Fn, 49 for Space) */
  keyCode: number;
  /** Required modifier flags mask (0 for no extra modifiers) */
  modifiers: number;
  /** Human-readable label (e.g., "Fn", "⌘Space") */
  label: string;
};

export type ShortcutSlotConfig = {
  id: string;
  binding: ShortcutBinding;
  holdThresholdMs?: number;
  doubleTapWindowMs?: number;
  /**
   * Called on raw keyDown before timing detection.
   * Return true to skip timing detection for this press (e.g., to stop overlay immediately).
   */
  onKeyDown?: () => boolean;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  onDoubleTap?: () => void;
  onSingleTap?: () => void;
};

type SlotState = {
  isDown: boolean;
  downTime: number;
  holdActive: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
  lastTapTime: number;
  doubleTapTimer: ReturnType<typeof setTimeout> | null;
  skipCurrent: boolean;
};

type KeyEvent = {
  type: "d" | "u";
  keyCode: number;
  flags: number;
};

// ── Shortcut matching ───────────────────────────────────────────────────

function matchesBinding(
  keyCode: number,
  flags: number,
  binding: ShortcutBinding,
): boolean {
  if (keyCode !== binding.keyCode) return false;

  if (MODIFIER_KEYCODES.has(binding.keyCode)) {
    // Modifier-only shortcut: ignore the key's OWN flag, check other modifiers
    const ownFlag = KEYCODE_TO_FLAG[binding.keyCode] ?? 0;
    const otherFlags = flags & ~ownFlag & MOD_MASK;
    return otherFlags === (binding.modifiers & MOD_MASK);
  } else {
    // Regular key combo: check that exactly the required modifiers are active
    const eventMods = flags & MOD_MASK;
    const requiredMods = binding.modifiers & MOD_MASK;
    return eventMods === requiredMods;
  }
}

// ── Label builder ───────────────────────────────────────────────────────

export function buildShortcutLabel(
  keyCode: number,
  modifiers: number,
): string {
  const parts: string[] = [];

  // Add modifier symbols in standard macOS order
  if (modifiers & MOD_FN) parts.push("Fn");
  if (modifiers & MOD_CONTROL) parts.push("⌃");
  if (modifiers & MOD_OPTION) parts.push("⌥");
  if (modifiers & MOD_SHIFT) parts.push("⇧");
  if (modifiers & MOD_COMMAND) parts.push("⌘");

  // Add the primary key label
  const keyLabel = MAC_KEYCODE_LABELS[keyCode];
  if (keyLabel) {
    // Don't duplicate if the key IS a modifier and already in parts
    if (!MODIFIER_KEYCODES.has(keyCode)) {
      parts.push(keyLabel);
    }
  } else {
    parts.push(`Key${keyCode}`);
  }

  return parts.join("") || `Key${keyCode}`;
}

// ── Default bindings ────────────────────────────────────────────────────

export const DEFAULT_BINDINGS = {
  dictation: {
    keyCode: 63, // Fn
    modifiers: 0,
    label: "Fn",
  } satisfies ShortcutBinding,
  assistant: {
    keyCode: 49, // Space
    modifiers: MOD_COMMAND,
    label: "⌘Space",
  } satisfies ShortcutBinding,
  meeting: {
    keyCode: 49, // Space
    modifiers: MOD_COMMAND | MOD_OPTION,
    label: "⌥⌘Space",
  } satisfies ShortcutBinding,
};

// ── Key monitor process management ──────────────────────────────────────

function getKeyMonitorBinaryPath(): string {
  // In production: resources/ is unpacked alongside the asar
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "key-monitor");
  }
  // In development: project root resources/
  return path.join(app.getAppPath(), "resources", "key-monitor");
}

function ensureKeyMonitorCompiled(): string {
  const binaryPath = getKeyMonitorBinaryPath();
  if (fs.existsSync(binaryPath)) return binaryPath;

  // Auto-compile from source in development
  const sourcePath = path.join(
    app.getAppPath(),
    "resources",
    "key-monitor.swift",
  );
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Key monitor binary not found at ${binaryPath} and source not found at ${sourcePath}`,
    );
  }

  log.info("Compiling key-monitor from source...");
  try {
    execSync(`swiftc -O -o "${binaryPath}" "${sourcePath}"`, {
      timeout: 30000,
    });
    log.info("key-monitor compiled successfully");
  } catch (err) {
    throw new Error(`Failed to compile key-monitor: ${err}`);
  }
  return binaryPath;
}

// ── Keyboard Hook ───────────────────────────────────────────────────────

export type KeyboardHook = {
  start: () => void;
  stop: () => void;
  setSlots: (slots: ShortcutSlotConfig[]) => void;
  /** Start recording the next keypress. Resolves with the binding. */
  startRecording: () => Promise<ShortcutBinding>;
  cancelRecording: () => void;
};

export function createKeyboardHook(): KeyboardHook {
  let process_: ChildProcess | null = null;
  let slots: ShortcutSlotConfig[] = [];
  const slotStates = new Map<string, SlotState>();
  let buffer = "";

  // Recording state
  let recordingResolve: ((binding: ShortcutBinding) => void) | null = null;

  function getOrCreateState(id: string): SlotState {
    let state = slotStates.get(id);
    if (!state) {
      state = {
        isDown: false,
        downTime: 0,
        holdActive: false,
        holdTimer: null,
        lastTapTime: 0,
        doubleTapTimer: null,
        skipCurrent: false,
      };
      slotStates.set(id, state);
    }
    return state;
  }

  function handleEvent(event: KeyEvent): void {
    // ── Recording mode: capture next keypress ──
    if (recordingResolve && event.type === "d") {
      if (MODIFIER_KEYCODES.has(event.keyCode)) {
        // It's a modifier key — wait for release to see if it's modifier-only,
        // or for a non-modifier key to capture the combo
        return;
      }
      // Non-modifier key pressed — capture the combo
      const modifiers = event.flags & MOD_MASK;
      // Exclude the Fn flag if it's just incidental (function keys set it)
      const binding: ShortcutBinding = {
        keyCode: event.keyCode,
        modifiers,
        label: buildShortcutLabel(event.keyCode, modifiers),
      };
      const resolve = recordingResolve;
      recordingResolve = null;
      resolve(binding);
      return;
    }

    if (recordingResolve && event.type === "u") {
      if (MODIFIER_KEYCODES.has(event.keyCode)) {
        // Modifier released without pressing another key — record as modifier-only
        const binding: ShortcutBinding = {
          keyCode: event.keyCode,
          modifiers: 0,
          label: buildShortcutLabel(event.keyCode, 0),
        };
        const resolve = recordingResolve;
        recordingResolve = null;
        resolve(binding);
        return;
      }
    }

    // ── Normal shortcut processing ──
    for (const slot of slots) {
      if (!matchesBinding(event.keyCode, event.flags, slot.binding)) continue;

      const state = getOrCreateState(slot.id);
      const holdThreshold = slot.holdThresholdMs ?? 150;
      const doubleTapWindow = slot.doubleTapWindowMs ?? 400;

      if (event.type === "d") {
        if (state.isDown) return; // ignore key repeat
        state.isDown = true;
        state.downTime = Date.now();
        state.skipCurrent = false;

        // Fast-path: let the caller decide to skip timing (e.g., stop active overlay)
        if (slot.onKeyDown?.()) {
          state.skipCurrent = true;
          return;
        }

        // Start hold timer
        state.holdTimer = setTimeout(() => {
          if (state.isDown && !state.skipCurrent) {
            state.holdActive = true;
            slot.onHoldStart?.();
          }
        }, holdThreshold);
      } else if (event.type === "u") {
        if (!state.isDown) return;
        state.isDown = false;

        if (state.holdActive) {
          // Was a hold — end it
          state.holdActive = false;
          if (state.holdTimer) {
            clearTimeout(state.holdTimer);
            state.holdTimer = null;
          }
          slot.onHoldEnd?.();
        } else if (!state.skipCurrent) {
          // Was a tap (short press)
          if (state.holdTimer) {
            clearTimeout(state.holdTimer);
            state.holdTimer = null;
          }

          const timeSinceLastTap = Date.now() - state.lastTapTime;
          state.lastTapTime = Date.now();

          if (timeSinceLastTap < doubleTapWindow && state.doubleTapTimer) {
            // Double tap!
            clearTimeout(state.doubleTapTimer);
            state.doubleTapTimer = null;
            slot.onDoubleTap?.();
          } else {
            // First tap — wait for potential second
            if (state.doubleTapTimer) clearTimeout(state.doubleTapTimer);
            state.doubleTapTimer = setTimeout(() => {
              state.doubleTapTimer = null;
              slot.onSingleTap?.();
            }, doubleTapWindow);
          }
        }
      }

      // Only process the first matching slot per event
      return;
    }
  }

  function parseLine(line: string): void {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (parsed.t === "ready") {
        log.info("Key monitor ready");
        return;
      }
      if (parsed.t === "d" || parsed.t === "u") {
        handleEvent({
          type: parsed.t,
          keyCode: parsed.k,
          flags: parsed.f,
        });
      }
    } catch {
      // Ignore malformed lines
    }
  }

  return {
    start() {
      if (process.platform !== "darwin") {
        log.warn("Keyboard hook only supported on macOS, skipping");
        return;
      }

      try {
        const binaryPath = ensureKeyMonitorCompiled();
        log.info(`Starting key monitor: ${binaryPath}`);

        process_ = spawn(binaryPath, [], {
          stdio: ["ignore", "pipe", "pipe"],
        });

        process_.stdout?.on("data", (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // Keep incomplete line in buffer
          for (const line of lines) {
            parseLine(line);
          }
        });

        process_.stderr?.on("data", (data: Buffer) => {
          const msg = data.toString().trim();
          if (msg.includes("accessibility")) {
            log.error(
              "Key monitor requires Accessibility permission. Grant in System Settings → Privacy & Security → Accessibility.",
            );
          } else {
            log.error(`Key monitor error: ${msg}`);
          }
        });

        process_.on("exit", (code) => {
          log.warn(`Key monitor exited with code ${code}`);
          process_ = null;
          // Auto-restart after 2 seconds if it crashed
          if (code !== 0 && code !== null) {
            setTimeout(() => {
              log.info("Restarting key monitor...");
              this.start();
            }, 2000);
          }
        });
      } catch (err) {
        log.error(`Failed to start key monitor: ${err}`);
      }
    },

    stop() {
      if (process_) {
        process_.kill();
        process_ = null;
      }
      // Clear all slot timers
      for (const state of slotStates.values()) {
        if (state.holdTimer) clearTimeout(state.holdTimer);
        if (state.doubleTapTimer) clearTimeout(state.doubleTapTimer);
      }
      slotStates.clear();
      buffer = "";
    },

    setSlots(newSlots: ShortcutSlotConfig[]) {
      // Clear old timers
      for (const state of slotStates.values()) {
        if (state.holdTimer) clearTimeout(state.holdTimer);
        if (state.doubleTapTimer) clearTimeout(state.doubleTapTimer);
      }
      slotStates.clear();
      slots = newSlots;
    },

    startRecording(): Promise<ShortcutBinding> {
      return new Promise((resolve) => {
        recordingResolve = resolve;
      });
    },

    cancelRecording() {
      recordingResolve = null;
    },
  };
}
