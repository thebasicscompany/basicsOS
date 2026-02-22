import type React from "react";
import type { Sparkles } from "@basicsos/ui";

// Derive the icon type from an actual Lucide icon so it stays structurally compatible.
type LucideIconType = typeof Sparkles;

export type ActionConfig = Record<string, unknown>;

export type ActionPrimitive = {
  type: string;
  label: string;
  description: string;
  Icon: LucideIconType;
  color: string;
  defaultConfig: ActionConfig;
  Form: React.ComponentType<{ config: ActionConfig; onChange: (c: ActionConfig) => void }>;
  summary: (config: ActionConfig) => string;
};
