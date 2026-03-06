export interface TagColor {
  name: string;
  bg: string;
  text: string;
  border: string;
}

export const TAG_COLOR_PALETTE: TagColor[] = [
  {
    name: "yellow",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
  },
  {
    name: "cyan",
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    border: "border-cyan-200",
  },
  {
    name: "olive",
    bg: "bg-lime-100",
    text: "text-lime-800",
    border: "border-lime-200",
  },
  {
    name: "red",
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
  {
    name: "green",
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
  },
  {
    name: "teal",
    bg: "bg-teal-100",
    text: "text-teal-800",
    border: "border-teal-200",
  },
  {
    name: "purple",
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-200",
  },
  {
    name: "blue",
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  {
    name: "orange",
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-200",
  },
  {
    name: "pink",
    bg: "bg-pink-100",
    text: "text-pink-800",
    border: "border-pink-200",
  },
  {
    name: "indigo",
    bg: "bg-indigo-100",
    text: "text-indigo-800",
    border: "border-indigo-200",
  },
  {
    name: "amber",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
  },
];

/**
 * @deprecated Use getStatusDotClass(label, colorName) instead of looking up by label.
 * Kept only for backward compatibility with status-badge.tsx until it is genericized.
 */
export const STATUS_DOT_COLORS: Record<string, string> = {};

const COLOR_NAME_TO_DOT_CLASS: Record<string, string> = {
  yellow: "bg-yellow-500",
  cyan: "bg-cyan-500",
  olive: "bg-lime-500",
  red: "bg-red-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
};

export function getNextAvailableColor(existingColors: string[]): string {
  const usedSet = new Set(existingColors);
  for (const color of TAG_COLOR_PALETTE) {
    if (!usedSet.has(color.name)) {
      return color.name;
    }
  }
  return TAG_COLOR_PALETTE[0].name;
}

export function getColorByHash(str: string): TagColor {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const index = Math.abs(hash) % TAG_COLOR_PALETTE.length;
  return TAG_COLOR_PALETTE[index];
}

export function getColorClasses(colorName: string): {
  bg: string;
  text: string;
  border: string;
} {
  const found = TAG_COLOR_PALETTE.find((c) => c.name === colorName);
  if (found) {
    return { bg: found.bg, text: found.text, border: found.border };
  }
  return {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-200",
  };
}

export function getStatusDotClass(label: string, colorName?: string): string {
  if (colorName && COLOR_NAME_TO_DOT_CLASS[colorName]) {
    return COLOR_NAME_TO_DOT_CLASS[colorName];
  }

  const hashed = getColorByHash(label);
  return COLOR_NAME_TO_DOT_CLASS[hashed.name] ?? "bg-gray-400";
}
