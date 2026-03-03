import { ROUTES } from "@basics-os/hub";
import type { ComponentType } from "react";
import {
  SquaresFourIcon,
  ChatCircleIcon,
  MicrophoneIcon,
  PlugIcon,
  HardDrivesIcon,
  PlusIcon,
  NotePencilIcon,
} from "@phosphor-icons/react";

export type NavItem = { title: string; path: string; icon: ComponentType<{ className?: string }> };
export type NavGroupConfig = { label: string; items: NavItem[] };

export const SIDEBAR_NAV_APPS: NavGroupConfig = {
  label: "Apps",
  items: [
    { title: "CRM", path: ROUTES.CRM, icon: SquaresFourIcon },
    { title: "AI Chat", path: ROUTES.CHAT, icon: ChatCircleIcon },
    { title: "Voice", path: ROUTES.VOICE, icon: MicrophoneIcon },
    { title: "MCP", path: ROUTES.MCP, icon: PlugIcon },
    { title: "Notes", path: ROUTES.NOTES, icon: NotePencilIcon },
  ],
};

export const SIDEBAR_NAV_AUTOMATIONS: NavGroupConfig = {
  label: "Automations",
  items: [
    { title: "Hub", path: ROUTES.AUTOMATIONS, icon: HardDrivesIcon },
    { title: "Builder", path: `${ROUTES.AUTOMATIONS}/create`, icon: PlusIcon },
  ],
};
