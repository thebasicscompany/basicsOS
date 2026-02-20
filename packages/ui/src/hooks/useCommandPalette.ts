"use client";

import { useState, useEffect, useCallback } from "react";

interface UseCommandPaletteReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * Registers a global Cmd+K / Ctrl+K keyboard shortcut to toggle a command palette.
 */
export const useCommandPalette = (): UseCommandPaletteReturn => {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // Listen for IPC-triggered open (desktop Cmd+K from menu/shortcut)
  useEffect(() => {
    const onIpcOpen = (): void => {
      setOpen(true);
    };
    window.addEventListener("open-command-palette", onIpcOpen);
    return () => window.removeEventListener("open-command-palette", onIpcOpen);
  }, []);

  return { open, setOpen, toggle };
};
