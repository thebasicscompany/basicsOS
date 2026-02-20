"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CommandPalette,
  CommandPaletteGroup,
  CommandPaletteItem,
  useCommandPalette,
  BookOpen,
  Users,
  CheckSquare,
  Video,
  Link2,
  Sparkles,
  ShieldCheck,
  Settings,
  Plus,
} from "@basicsos/ui";
import { useAuth } from "./AuthProvider";
import { readRecentRoutes } from "@/lib/recent-routes";
import type { RecentRoute } from "@/lib/recent-routes";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => undefined,
});

export const useCommandPaletteContext = (): CommandPaletteContextValue =>
  useContext(CommandPaletteContext);

const NAV_COMMANDS = [
  { label: "Knowledge Base", href: "/knowledge", Icon: BookOpen, color: "text-amber-600" },
  { label: "CRM", href: "/crm", Icon: Users, color: "text-blue-600" },
  { label: "Tasks", href: "/tasks", Icon: CheckSquare, color: "text-emerald-600" },
  { label: "Meetings", href: "/meetings", Icon: Video, color: "text-violet-600" },
  { label: "Hub", href: "/hub", Icon: Link2, color: "text-rose-600" },
  { label: "Assistant", href: "/assistant", Icon: Sparkles, color: "text-primary" },
  { label: "Settings", href: "/settings", Icon: Settings, color: "text-stone-500" },
] as const;

const CREATE_COMMANDS = [
  { label: "New Task", href: "/tasks?create=true" },
  { label: "New Contact", href: "/crm?tab=contacts&create=true" },
  { label: "New Deal", href: "/crm?tab=deals&create=true" },
  { label: "New Document", href: "/knowledge/new" },
  { label: "New Meeting", href: "/meetings?create=true" },
  { label: "New Link", href: "/hub?create=true" },
] as const;


export const CommandPaletteProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const { open, setOpen } = useCommandPalette();
  const router = useRouter();
  const { user } = useAuth();
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);

  // Load recent routes when palette opens
  useEffect(() => {
    if (open) {
      setRecentRoutes(readRecentRoutes());
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  const isAdmin = user?.role === "admin";

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen}>
        {/* Recent routes */}
        {recentRoutes.length > 0 && (
          <CommandPaletteGroup heading="Recent">
            {recentRoutes.map((route) => (
              <CommandPaletteItem
                key={route.path}
                onSelect={() => navigate(route.path)}
              >
                {route.title}
              </CommandPaletteItem>
            ))}
          </CommandPaletteGroup>
        )}

        {/* Navigate */}
        <CommandPaletteGroup heading="Navigate">
          {NAV_COMMANDS.map((cmd) => (
            <CommandPaletteItem
              key={cmd.href}
              icon={<cmd.Icon size={18} className={cmd.color} />}
              onSelect={() => navigate(cmd.href)}
            >
              {cmd.label}
            </CommandPaletteItem>
          ))}
          {isAdmin && (
            <CommandPaletteItem
              icon={<ShieldCheck size={18} />}
              onSelect={() => navigate("/admin/team")}
            >
              Admin
            </CommandPaletteItem>
          )}
        </CommandPaletteGroup>

        {/* Create */}
        <CommandPaletteGroup heading="Create">
          {CREATE_COMMANDS.map((cmd) => (
            <CommandPaletteItem
              key={cmd.label}
              icon={<Plus size={18} className="text-stone-400" />}
              onSelect={() => navigate(cmd.href)}
            >
              {cmd.label}
            </CommandPaletteItem>
          ))}
        </CommandPaletteGroup>
      </CommandPalette>
    </CommandPaletteContext.Provider>
  );
};
