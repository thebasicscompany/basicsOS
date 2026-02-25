"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Converts a hex color (#rrggbb) to an oklch() CSS string.
 * Uses the sRGB → linear-sRGB → OKLab → OKLCH pipeline.
 */
function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // sRGB → linear
  const toLinear = (v: number): number =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  // linear sRGB → OKLab (via LMS)
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bOk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bOk * bOk);
  let H = (Math.atan2(bOk, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

function oklchStr(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

/**
 * Returns true if a color (given as oklch lightness) is perceptually light,
 * meaning it needs dark foreground text for contrast.
 */
function isLightColor(l: number): boolean {
  return l > 0.65;
}

const CSS_VARS_DARK = (l: number, c: number, h: number) => ({
  "--primary": oklchStr(l, c, h),
  "--ring": oklchStr(l, c, h),
  "--sidebar-primary": oklchStr(l, c, h),
  "--sidebar-ring": oklchStr(l, c, h),
  // Foreground should contrast with the accent
  "--primary-foreground": isLightColor(l) ? "oklch(0.13 0.005 260)" : "oklch(0.96 0 0)",
  "--sidebar-primary-foreground": isLightColor(l) ? "oklch(0.13 0.005 260)" : "oklch(0.96 0 0)",
});

const CSS_VARS_LIGHT = (l: number, c: number, h: number) => {
  // For light mode, darken the color slightly for better contrast on white backgrounds
  const darkened = Math.max(l - 0.2, 0.3);
  return {
    "--primary": oklchStr(darkened, c, h),
    "--ring": oklchStr(darkened, c, h),
    "--sidebar-primary": oklchStr(darkened, c, h),
    "--sidebar-ring": oklchStr(darkened, c, h),
    "--primary-foreground": "oklch(0.985 0 0)",
    "--sidebar-primary-foreground": "oklch(0.985 0 0)",
  };
};

/**
 * Applies the tenant's accent color to CSS custom properties.
 * Mounted in the dashboard layout — reads from the cached `auth.me` query.
 */
export function BrandingStyle(): null {
  const { data: me } = trpc.auth.me.useQuery();

  useEffect(() => {
    const hex = me?.accentColor;
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;

    const { l, c, h } = hexToOklch(hex);
    const root = document.documentElement;
    const isLight = root.classList.contains("light");

    const vars = isLight ? CSS_VARS_LIGHT(l, c, h) : CSS_VARS_DARK(l, c, h);
    const entries = Object.entries(vars);

    for (const [prop, value] of entries) {
      root.style.setProperty(prop, value);
    }

    return () => {
      for (const [prop] of entries) {
        root.style.removeProperty(prop);
      }
    };
  }, [me?.accentColor]);

  // Also react to theme changes (light/dark toggle)
  useEffect(() => {
    const hex = me?.accentColor;
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;

    const observer = new MutationObserver(() => {
      const { l, c, h } = hexToOklch(hex);
      const root = document.documentElement;
      const isLight = root.classList.contains("light");
      const vars = isLight ? CSS_VARS_LIGHT(l, c, h) : CSS_VARS_DARK(l, c, h);
      for (const [prop, value] of Object.entries(vars)) {
        root.style.setProperty(prop, value);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [me?.accentColor]);

  return null;
}
