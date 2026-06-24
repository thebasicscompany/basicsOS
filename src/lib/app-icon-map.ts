/**
 * Maps AppConfig.icon slug strings to Phosphor icon components (custom apps).
 * Mirrors object-icon-map.ts; falls back to a grid icon for unknown slugs.
 */
import {
  SquaresFourIcon,
  AppWindowIcon,
  GaugeIcon,
  ChartBarIcon,
  TableIcon,
  ListChecksIcon,
  HandshakeIcon,
  CalendarIcon,
} from "@phosphor-icons/react";

type PhosphorIcon = typeof SquaresFourIcon;

const ICON_MAP: Record<string, PhosphorIcon> = {
  "layout-grid": SquaresFourIcon,
  "squares-four": SquaresFourIcon,
  app: AppWindowIcon,
  "app-window": AppWindowIcon,
  dashboard: GaugeIcon,
  gauge: GaugeIcon,
  chart: ChartBarIcon,
  "chart-bar": ChartBarIcon,
  table: TableIcon,
  checklist: ListChecksIcon,
  handshake: HandshakeIcon,
  calendar: CalendarIcon,
};

const FALLBACK_ICON = SquaresFourIcon;

/** Resolve an app icon slug to a Phosphor icon component (with fallback). */
export function getAppIcon(slug: string): PhosphorIcon {
  return ICON_MAP[slug] ?? FALLBACK_ICON;
}
