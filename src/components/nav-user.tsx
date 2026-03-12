import {
  CaretUpDownIcon,
  ChartBarIcon,
  DownloadSimpleIcon,
  GearIcon,
  IdentificationCardIcon,
  InfoIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { useHelpCenter } from "@/hooks/use-help-center";
import { useMe } from "@/hooks/use-me";
import { ROUTES } from "@basics-os/hub";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: session, isPending } = useSession();
  const { data: me } = useMe();
  const { openHelp } = useHelpCenter();
  const navigate = useNavigate();
  const isAdmin = Boolean(me?.administrator);

  if (isPending) return null;

  const user = session?.user;
  if (!user) return null;

  const name = user.name ?? user.email ?? "IconUser";
  const email = user.email ?? "";
  const avatar = user.image ?? "";
  const initials = getInitials(name);

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/");
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <CaretUpDownIcon size={32} className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to={ROUTES.PROFILE}>
                  <IdentificationCardIcon className="size-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={ROUTES.SETTINGS}>
                  <GearIcon className="size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={ROUTES.IMPORT}>
                  <DownloadSimpleIcon className="size-4" />
                  Import
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openHelp}>
                <InfoIcon className="size-4" />
                Help Center
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to={ROUTES.ADMIN_USAGE}>
                    <ChartBarIcon className="size-4" />
                    AI Usage
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <SignOutIcon className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
