import { ROUTES } from "@basics-os/hub";
import type { ComponentType } from "react";
import {
  HouseIcon,
  MicrophoneIcon,
  HardDrivesIcon,
  NotePencilIcon,
} from "@phosphor-icons/react";

export type NavItem = {
  title: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
};
export type NavGroupConfig = { label: string; items: NavItem[] };

export const SIDEBAR_NAV_APPS: NavGroupConfig = {
  label: "Apps",
  items: [
    { title: "Home", path: ROUTES.CRM, icon: HouseIcon },
    { title: "Voice", path: ROUTES.VOICE, icon: MicrophoneIcon },

    { title: "Notes", path: ROUTES.NOTES, icon: NotePencilIcon },
  ],
};

export const SIDEBAR_NAV_AUTOMATIONS: NavGroupConfig = {
  label: "Automations",
  items: [{ title: "Hub", path: ROUTES.AUTOMATIONS, icon: HardDrivesIcon }],
};
