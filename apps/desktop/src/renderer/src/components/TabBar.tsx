import { Search, Video, Mic, Camera } from "@basicsos/ui";
import type { ComponentType, SVGProps } from "react";

type Tab = "ask" | "meetings" | "voice" | "capture";
type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "ask", label: "Ask", Icon: Search },
  { id: "meetings", label: "Meetings", Icon: Video },
  { id: "voice", label: "Voice", Icon: Mic },
  { id: "capture", label: "Capture", Icon: Camera },
];

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export const TabBar = ({ active, onChange }: TabBarProps): JSX.Element => (
  <div className="flex px-4 pb-3 gap-1">
    {TABS.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        type="button"
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-all ${
          active === t.id
            ? "bg-stone-900 text-white shadow-sm"
            : "text-stone-500 hover:text-stone-700 hover:bg-stone-100"
        }`}
      >
        <t.Icon size={14} />
        <span>{t.label}</span>
      </button>
    ))}
  </div>
);

export type { Tab };
