import { useState, type ComponentProps } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  MagnifyingGlassIcon,
  ChatCircleIcon,
  PlusIcon,
  HardDrivesIcon,
  HouseIcon,
  MicrophoneIcon,
  NotePencilIcon,
  CheckSquareIcon,
  SidebarIcon,
  VideoCameraIcon,
  InfoIcon,
  CaretRightIcon,
  DotsThreeIcon,
} from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavUser } from "@/components/nav-user";
import { ObjectRegistryNavSection } from "@/components/ObjectRegistryNavSection";
import { useOrganization } from "@/hooks/use-organization";
import { useThreads } from "@/hooks/use-threads";
import { ROUTES } from "@basics-os/hub";
import { Kbd } from "@/components/ui/kbd";
import {
  dispatchCommandPaletteShortcut,
  getCommandPaletteShortcutLabel,
} from "@/lib/keyboard-shortcuts";
import { useHelpCenter } from "@/hooks/use-help-center";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const CHAT_PREVIEW_COUNT = 3;

function AllChatsPopover({
  threads,
  open,
  onOpenChange,
}: {
  threads: Array<{ id: string; title: string | null; channel: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="All chats"
        >
          <DotsThreeIcon className="size-3.5" />
          <span>+{threads.length} more</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-56 p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            All Chats
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            title="New chat"
            onClick={() => {
              void navigate("/chat");
              onOpenChange(false);
            }}
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
          {threads.map((thread) => {
            const threadPath = `/chat/${thread.id}`;
            const isActive = pathname === threadPath;
            const isVoice = thread.channel === "voice";
            return (
              <Link
                key={thread.id}
                to={threadPath}
                onClick={() => onOpenChange(false)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-foreground/80"
                }`}
              >
                {isVoice ? (
                  <MicrophoneIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChatCircleIcon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate min-w-0 flex-1">
                  {thread.title ?? "Untitled"}
                </span>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChatThreadsNav() {
  const { pathname } = useLocation();
  const { data: threads } = useThreads(50);
  const allThreads = (threads ?? []).filter(
    (t) => t.channel === "chat" || t.channel === "voice",
  );
  const previewThreads = allThreads.slice(0, CHAT_PREVIEW_COUNT);
  const overflowThreads = allThreads.slice(CHAT_PREVIEW_COUNT);
  const hasMore = overflowThreads.length > 0;
  const isOnChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <SidebarGroup>
      <div className="flex items-center">
        <SidebarGroupLabel asChild className="flex-1">
          <Link
            to="/chat"
            className="flex w-full items-center gap-1 hover:text-foreground transition-colors"
          >
            <ChatCircleIcon className="size-3 shrink-0" />
            Chats
          </Link>
        </SidebarGroupLabel>
        <SidebarGroupAction title="New Chat" asChild>
          <Link to="/chat">
            <PlusIcon className="size-4" />
          </Link>
        </SidebarGroupAction>
      </div>
      <SidebarGroupContent>
        <SidebarMenu>
          {previewThreads.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isOnChat}
                tooltip="Start new chat"
              >
                <Link to="/chat">
                  <ChatCircleIcon className="size-4" />
                  <span>Start new chat</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <>
              {previewThreads.map((thread) => {
                const threadPath = `/chat/${thread.id}`;
                const isVoice = thread.channel === "voice";
                return (
                  <SidebarMenuItem key={thread.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === threadPath}
                      tooltip={thread.title ?? "Untitled"}
                    >
                      <Link to={threadPath}>
                        {isVoice ? (
                          <MicrophoneIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChatCircleIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-xs">
                          {thread.title ?? "Untitled"}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {hasMore && (
                <SidebarMenuItem>
                  <div className="px-2 py-0.5">
                    <AllChatsPopover
                      threads={overflowThreads}
                      open={popoverOpen}
                      onOpenChange={setPopoverOpen}
                    />
                  </div>
                </SidebarMenuItem>
              )}
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AutomationsNav() {
  const { pathname } = useLocation();
  const isActive =
    pathname === ROUTES.AUTOMATIONS ||
    pathname.startsWith(ROUTES.AUTOMATIONS + "/");
  const [open, setOpen] = useState(true);

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
              Automations
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <SidebarGroupAction title="New automation" asChild>
            <Link to={`${ROUTES.AUTOMATIONS}/create`}>
              <PlusIcon className="size-4" />
            </Link>
          </SidebarGroupAction>
        </div>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive} tooltip="Hub">
                  <Link to={ROUTES.AUTOMATIONS}>
                    <HardDrivesIcon className="size-4" />
                    <span>Hub</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { data: organization } = useOrganization();
  const { pathname } = useLocation();
  const { toggleSidebar } = useSidebar();
  const { openHelp } = useHelpCenter();
  const shortcutLabel = getCommandPaletteShortcutLabel();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-14 min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-md px-2 group-data-[collapsible=icon]:hidden">
              {organization?.logo?.src ? (
                <Avatar className="size-8 shrink-0 rounded">
                  <AvatarImage
                    src={organization.logo.src}
                    alt={organization?.name ?? "Org"}
                  />
                  <AvatarFallback className="rounded text-xs font-medium">
                    {(organization?.name ?? "B").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : null}
              <span className="truncate flex-1 min-w-0 font-semibold text-base">
                {organization?.name ?? "Basics Hub"}
              </span>
              <SidebarTrigger className="size-8 shrink-0 ml-auto [&_svg]:!size-6" />
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
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help"
              className="text-muted-foreground"
              onClick={openHelp}
            >
              <InfoIcon className="size-4" />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="hidden group-data-[collapsible=icon]:list-item">
                <SidebarMenuButton
                  tooltip="Toggle sidebar"
                  onClick={toggleSidebar}
                >
                  <SidebarIcon />
                  <span>Collapse</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === ROUTES.CRM}
                  tooltip="Home"
                >
                  <Link to={ROUTES.CRM}>
                    <HouseIcon className="size-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === ROUTES.VOICE}
                  tooltip="Voice"
                >
                  <Link to={ROUTES.VOICE}>
                    <MicrophoneIcon className="size-4" />
                    <span>Voice</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === ROUTES.NOTES}
                  tooltip="Notes"
                >
                  <Link to={ROUTES.NOTES}>
                    <NotePencilIcon className="size-4" />
                    <span>Notes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === ROUTES.TASKS}
                  tooltip="Tasks"
                >
                  <Link to={ROUTES.TASKS}>
                    <CheckSquareIcon className="size-4" />
                    <span>Tasks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === ROUTES.MEETINGS}
                  tooltip="Meetings"
                >
                  <Link to={ROUTES.MEETINGS}>
                    <VideoCameraIcon className="size-4" />
                    <span>Meetings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <ChatThreadsNav />
        <div>
          <ObjectRegistryNavSection />
        </div>
        <div>
          <AutomationsNav />
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
