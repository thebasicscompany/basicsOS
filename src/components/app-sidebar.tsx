import type { ComponentProps } from "react";
import { MagnifyingGlassIcon, ChartBarIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "react-router";
import { ROUTES } from "@basics-os/hub";
import { NavGroup } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ObjectRegistryNavSection } from "@/components/ObjectRegistryNavSection";
import { useOrganization } from "@/hooks/use-organization";
import { useMe } from "@/hooks/use-me";
import {
  SIDEBAR_NAV_APPS,
  SIDEBAR_NAV_AUTOMATIONS,
} from "@/config/sidebar-nav";
import { Kbd } from "@/components/ui/kbd";
import {
  dispatchCommandPaletteShortcut,
  getCommandPaletteShortcutLabel,
} from "@/lib/keyboard-shortcuts";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { data: organization } = useOrganization();
  const { data: me } = useMe();
  const { pathname } = useLocation();
  const shortcutLabel = getCommandPaletteShortcutLabel();
  const isAdmin = Boolean(me?.administrator);
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-12 min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-md px-2 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2">
              {organization?.logo?.src ? (
                <img
                  src={organization.logo.src}
                  alt=""
                  className="size-8 shrink-0 rounded object-contain group-data-[collapsible=icon]:size-6"
                />
              ) : null}
              <span className="truncate font-semibold text-sm group-data-[collapsible=icon]:hidden">
                {organization?.name ?? "Basics Hub"}
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={`Search (${shortcutLabel})`}
              className="text-muted-foreground"
              onClick={dispatchCommandPaletteShortcut}
            >
              <MagnifyingGlassIcon className="size-4" />
              <span className="flex-1">Search</span>
              <Kbd className="ml-auto text-[10px] tracking-widest group-data-[state=collapsed]:hidden">
                {shortcutLabel}
              </Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup {...SIDEBAR_NAV_APPS} />
        <ObjectRegistryNavSection />
        <NavGroup {...SIDEBAR_NAV_AUTOMATIONS} />
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(ROUTES.ADMIN_USAGE)}
                    tooltip="AI Usage"
                  >
                    <Link to={ROUTES.ADMIN_USAGE}>
                      <ChartBarIcon className="size-4" />
                      <span>AI Usage</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
