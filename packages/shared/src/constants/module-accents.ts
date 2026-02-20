/**
 * Module accent colors and icons used by the icon rail sidebar and command palette.
 * Icon names reference lucide-react exports.
 */
export const MODULE_ACCENTS = {
  knowledge: { label: "Knowledge Base", icon: "BookOpen", color: "text-amber-600", bg: "bg-amber-50" },
  crm: { label: "CRM", icon: "Users", color: "text-blue-600", bg: "bg-blue-50" },
  tasks: { label: "Tasks", icon: "CheckSquare", color: "text-emerald-600", bg: "bg-emerald-50" },
  meetings: { label: "Meetings", icon: "Video", color: "text-violet-600", bg: "bg-violet-50" },
  hub: { label: "Hub", icon: "Link2", color: "text-rose-600", bg: "bg-rose-50" },
  assistant: { label: "Assistant", icon: "Sparkles", color: "text-primary", bg: "bg-primary/10" },
} as const;

export type ModuleId = keyof typeof MODULE_ACCENTS;
