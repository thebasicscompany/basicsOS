import { ROUTES } from "@basics-os/hub";
import {
  type LucideIcon,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Server,
  Link,
  Zap,
  Plus,
  Play,
  FileText,
} from "lucide-react";

export type NavItem = { title: string; path: string; icon: LucideIcon };
export type NavGroupConfig = { label: string; items: NavItem[] };

export const SIDEBAR_NAV_APPS: NavGroupConfig = {
  label: "Apps",
  items: [
    { title: "CRM", path: ROUTES.CRM, icon: LayoutDashboard },
    { title: "AI Chat", path: ROUTES.CHAT, icon: MessageSquare },
    { title: "Voice", path: ROUTES.VOICE, icon: Mic },
    { title: "MCP", path: ROUTES.MCP, icon: Server },
    { title: "Connections", path: ROUTES.CONNECTIONS, icon: Link },
  ],
};

export const SIDEBAR_NAV_AUTOMATIONS: NavGroupConfig = {
  label: "Automations",
  items: [
    { title: "All", path: ROUTES.AUTOMATIONS, icon: Zap },
    { title: "Builder", path: `${ROUTES.AUTOMATIONS}/create`, icon: Plus },
    { title: "Runs", path: ROUTES.AUTOMATIONS_RUNS, icon: Play },
    { title: "Logs", path: ROUTES.AUTOMATIONS_LOGS, icon: FileText },
  ],
};
