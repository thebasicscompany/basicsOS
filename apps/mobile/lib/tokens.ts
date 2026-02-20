/** Shared design tokens — mirrors packages/ui/src/tokens.css for React Native */

export const colors = {
  // Surfaces — 3-level ladder: app chrome → panel → card
  surfaceApp: "#e7e5e4",       // stone-200 — outer chrome
  surfacePanel: "#f5f5f4",     // stone-100 — panels
  surfaceCard: "#ffffff",      // white — cards
  surfaceSubtle: "#f5f5f4",    // stone-100

  // Borders — visible on all surfaces
  border: "#d6d3d1",           // stone-300
  borderStrong: "#a8a29e",     // stone-400

  // Text — WCAG 4.5:1 minimum
  textPrimary: "#1c1917",      // stone-900
  textSecondary: "#57534e",    // stone-600
  textPlaceholder: "#78716c",  // stone-500
  textTertiary: "#a8a29e",     // stone-400 (decorative only)

  // Brand
  brand: "#6366f1",
  brandHover: "#4f46e5",
  brandSubtle: "#eef2ff",

  // Status
  success: "#22c55e",
  successSubtle: "#dcfce7",
  warning: "#f59e0b",
  warningSubtle: "#fef3c7",
  destructive: "#ef4444",
  destructiveSubtle: "#fee2e2",

  // Module accents
  emerald: "#059669",
  emeraldSubtle: "#ecfdf5",
  blue: "#3b82f6",
  blueSubtle: "#eff6ff",
  violet: "#7c3aed",
  violetSubtle: "#ede9fe",
  amber: "#d97706",
  amberSubtle: "#fffbeb",
  rose: "#e11d48",
  roseSubtle: "#fff1f2",
  orange: "#f97316",
  orangeSubtle: "#fff7ed",
  pink: "#ec4899",
  pinkSubtle: "#fdf2f8",

  // Contrast
  white: "#ffffff",
  black: "#000000",
  destructiveBorder: "#fca5a5",
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: "#1c1917",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  overlay: {
    shadowColor: "#1c1917",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

/** Derive a deterministic pastel avatar color from a name string */
export const nameToColor = (name: string): { bg: string; text: string } => {
  const palette = [
    { bg: "#eef2ff", text: "#6366f1" },
    { bg: "#eff6ff", text: "#3b82f6" },
    { bg: "#ecfdf5", text: "#059669" },
    { bg: "#ede9fe", text: "#7c3aed" },
    { bg: "#fffbeb", text: "#d97706" },
    { bg: "#fff1f2", text: "#e11d48" },
    { bg: "#fdf2f8", text: "#db2777" },
    { bg: "#f0fdfa", text: "#0d9488" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length]!;
};
