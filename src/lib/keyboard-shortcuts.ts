const isMacPlatform = () =>
  typeof navigator !== "undefined" &&
  /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform);

export function getCommandPaletteShortcutLabel(): string {
  return isMacPlatform() ? "Cmd+K" : "Ctrl+K";
}

export function getPrimaryModifierLabel(): "Cmd" | "Ctrl" {
  return isMacPlatform() ? "Cmd" : "Ctrl";
}

export const OPEN_COMMAND_PALETTE_EVENT = "open-command-palette";

/** Opens the command palette (e.g. from sidebar Search button). Prefer this over simulating keydown. */
export function dispatchCommandPaletteShortcut(): void {
  document.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT, { bubbles: true }));
}
