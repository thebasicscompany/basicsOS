import type { ComponentProps } from "react"
import { GalleryVerticalEnd, Search } from "lucide-react"

import { WorkspaceSwitcher } from "@/components/workspace-switcher"
import { NavGroup } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { ObjectRegistryNavSection } from "@/components/ObjectRegistryNavSection"
import { SIDEBAR_NAV_APPS, SIDEBAR_NAV_AUTOMATIONS } from "@/config/sidebar-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const WORKSPACES = [
  { name: "Basics Hub", logo: GalleryVerticalEnd, plan: "Desktop" },
]

function dispatchSearch() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  )
}

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher workspaces={WORKSPACES} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search (⌘K)"
              className="text-muted-foreground"
              onClick={dispatchSearch}
            >
              <Search className="size-4" />
              <span className="flex-1">Search</span>
              <kbd className="ml-auto text-[10px] tracking-widest text-muted-foreground/60 group-data-[state=collapsed]:hidden">
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup {...SIDEBAR_NAV_APPS} />
        <ObjectRegistryNavSection />
        <NavGroup {...SIDEBAR_NAV_AUTOMATIONS} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
