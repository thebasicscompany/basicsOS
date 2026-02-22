"use client";

import { useTheme } from "next-themes";
import { Button } from "@basicsos/ui";
import { useEffect, useState } from "react";

/**
 * Toggles between light and dark theme. Uses next-themes so the choice is persisted.
 */
export function ThemeToggle(): JSX.Element {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        className="justify-start gap-3 px-3 py-2 h-auto text-sm font-normal text-stone-500 w-full"
        disabled
      >
        <span className="size-4 shrink-0 rounded-full bg-stone-200 dark:bg-stone-700" />
        <span className="flex-1 text-left">Theme</span>
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      className="justify-start gap-3 px-3 py-2 h-auto text-sm font-normal text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 w-full"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span
        className="size-4 shrink-0 rounded-full border-2 border-current"
        aria-hidden
      />
      <span className="flex-1 text-left">
        {isDark ? "Dark" : "Light"}
      </span>
    </Button>
  );
}
