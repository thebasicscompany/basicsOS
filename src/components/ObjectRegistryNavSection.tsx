import { useState } from "react";
import { Link, useLocation } from "react-router";
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useObjects } from "@/hooks/use-object-registry";
import { getObjectIcon } from "@/lib/object-icon-map";
import { CreateObjectModal } from "@/components/create-object/CreateObjectModal";
import { useEmailSyncStatus } from "@/hooks/use-email-sync";

export function ObjectRegistryNavSection() {
  const objects = useObjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [open, setOpen] = useState(true);
  const { data: syncStatus } = useEmailSyncStatus();
  const pendingSuggestions = syncStatus?.pendingSuggestions ?? 0;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarGroup>
        <div className="flex items-center">
          <SidebarGroupLabel asChild className="flex-1">
            <CollapsibleTrigger className="flex w-full items-center gap-1">
              <CaretRightIcon className="size-3 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              Records
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <SidebarGroupAction
            title="New object"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon className="size-4" />
          </SidebarGroupAction>
        </div>
        <CreateObjectModal open={createOpen} onOpenChange={setCreateOpen} />
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {objects.map((obj) => (
                <ObjectNavItem
                  key={obj.id}
                  slug={obj.slug}
                  label={obj.pluralName}
                  iconSlug={obj.icon}
                  badgeCount={obj.slug === "contacts" ? pendingSuggestions : 0}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function ObjectNavItem({
  slug,
  label,
  iconSlug,
  badgeCount,
}: {
  slug: string;
  label: string;
  iconSlug: string;
  badgeCount?: number;
}) {
  const location = useLocation();
  const objectPath = `/objects/${slug}`;
  const isActive = location.pathname.startsWith(objectPath);
  const IconComponent = getObjectIcon(iconSlug);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link to={objectPath}>
          <IconComponent className="size-4 shrink-0" />
          {label}
        </Link>
      </SidebarMenuButton>
      {badgeCount != null && badgeCount > 0 && (
        <SidebarMenuBadge>{badgeCount}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}
