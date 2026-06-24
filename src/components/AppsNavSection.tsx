import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useApps } from "@/hooks/use-app-registry";
import { getAppIcon } from "@/lib/app-icon-map";

/**
 * Sidebar "Apps" section — clones ObjectRegistryNavSection. Lists every active
 * custom app (org-wide) as a link to /apps/:slug, plus a "+" to the in-app builder
 * (/apps/new). Like the object create button, the "+" shows for everyone; the
 * builder/publish is gated to admins server-side (object_config.write).
 */
export function AppsNavSection() {
  const apps = useApps();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const { state } = useSidebar();
  // When collapsed to icons, always show items so they never vanish from the rail.
  const effectiveOpen = state === "collapsed" ? true : open;

  return (
    <Collapsible
      open={effectiveOpen}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarGroup>
        <div className="flex items-center">
          <SidebarGroupLabel asChild className="flex-1">
            <CollapsibleTrigger className="flex w-full items-center gap-1">
              <CaretRightIcon className="size-3 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              Apps
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <SidebarGroupAction title="Build an app" onClick={() => navigate("/apps/new")}>
            <PlusIcon className="size-4" />
          </SidebarGroupAction>
        </div>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {apps.map((app) => (
                <AppNavItem
                  key={app.id}
                  slug={app.slug}
                  label={app.name}
                  iconSlug={app.icon}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function AppNavItem({
  slug,
  label,
  iconSlug,
}: {
  slug: string;
  label: string;
  iconSlug: string;
}) {
  const location = useLocation();
  const appPath = `/apps/${slug}`;
  const isActive = location.pathname.startsWith(appPath);
  const IconComponent = getAppIcon(iconSlug);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link to={appPath}>
          <IconComponent className="size-4 shrink-0" />
          {label}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
