import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "react-error-boundary";
import { useQueryClient } from "@tanstack/react-query";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  PageHeaderProvider,
  usePageHeaderTitle,
  useRegisterActionsContainer,
  useRegisterBreadcrumbContainer,
  useRegisterTitleSlotContainer,
  useTitleSlotInUse,
} from "@/contexts/page-header";
import { useRecentPages } from "@/hooks/use-recent-pages";
import { useObjects } from "@/hooks/use-object-registry";

function PageErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-destructive/50 bg-destructive/10 p-6"
      role="alert"
    >
      <p className="font-medium text-destructive">Something went wrong</p>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="mt-4 text-sm font-medium text-primary hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

function LayoutHeader() {
  const location = useLocation();
  const { state } = useSidebar();
  usePageHeaderTitle();
  const titleSlotInUse = useTitleSlotInUse();
  const registerBreadcrumbContainer = useRegisterBreadcrumbContainer();
  const registerTitleSlotContainer = useRegisterTitleSlotContainer();
  const isBuilder = /^\/automations\/(create|\d+)/.test(location.pathname);
  const isRecordDetail = /^\/objects\/[^/]+\/\d+/.test(location.pathname);
  const sidebarWidth = state === "expanded" ? "pl-[216px]" : "pl-[5.5rem]";
  return (
    <header className="drag-region flex h-[52px] shrink-0 items-center gap-3 bg-surface-canvas">
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 transition-[padding] duration-200",
          sidebarWidth,
          isBuilder ? "pr-14" : isRecordDetail ? "pr-6" : "px-14",
        )}
      >
        {titleSlotInUse && (
          <div
            ref={registerTitleSlotContainer}
            className="min-w-0 shrink-0 overflow-hidden [&>*]:truncate"
          />
        )}
        {/* Breadcrumb portal — RecordDetailPage renders here */}
        <div
          ref={registerBreadcrumbContainer}
          className="min-w-0 flex-1 overflow-hidden [&>*]:truncate"
        />
      </div>
    </header>
  );
}

function LayoutContent() {
  const location = useLocation();
  const title = usePageHeaderTitle();
  const registerActionsContainer = useRegisterActionsContainer();
  const isBuilder = /^\/automations\/(create|\d+)/.test(location.pathname);
  const isRecordDetail = /^\/objects\/[^/]+\/\d+/.test(location.pathname);
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div
        className={
          isBuilder
            ? "flex w-full flex-1 flex-col min-h-0 pl-0 pr-14 pt-8"
            : isRecordDetail
              ? "flex w-full flex-1 flex-col px-6 pt-6 min-h-0"
              : "flex w-full flex-1 flex-col px-14 pt-8 min-h-0"
        }
        id="main-content"
      >
        {/* Page title + actions bar */}
        <div className="flex shrink-0 items-center gap-2.5 [&:has(>:not(:empty))]:pb-6">
          {title && (
            <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          )}
          <div
            ref={registerActionsContainer}
            className="flex flex-1 items-center justify-end gap-2.5 empty:hidden"
          />
        </div>
        <ErrorBoundary
          key={location.pathname}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <PageErrorFallback
              error={error instanceof Error ? error : new Error(String(error))}
              resetErrorBoundary={resetErrorBoundary}
            />
          )}
        >
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}

/** Well-known pages that aren't object-registry backed */
const STATIC_PAGES: Record<string, { label: string; icon: string }> = {
  "/chat": { label: "Chat", icon: "chat" },
  "/automations": { label: "Automations", icon: "automations" },
  "/tasks": { label: "Tasks", icon: "tasks" },
  "/notes": { label: "Notes", icon: "notes" },
  "/voice": { label: "Voice", icon: "voice" },
  "/mcp": { label: "MCP", icon: "mcp" },
  "/settings": { label: "Settings", icon: "settings" },
};

function useTrackPageVisits() {
  const { pathname } = useLocation();
  const objects = useObjects();
  const [, addRecentPage] = useRecentPages();

  useEffect(() => {
    // Skip home page itself and record detail pages
    if (pathname === "/home" || pathname === "/") return;

    // Check for chat thread pages → track as "Chat"
    if (pathname.startsWith("/chat")) {
      addRecentPage({
        key: "/chat",
        label: "Chat",
        path: "/chat",
        icon: "chat",
        visitedAt: Date.now(),
      });
      return;
    }

    // Check for automations sub-pages → track as "Automations"
    if (pathname.startsWith("/automations")) {
      addRecentPage({
        key: "/automations",
        label: "Automations",
        path: "/automations",
        icon: "automations",
        visitedAt: Date.now(),
      });
      return;
    }

    // Check for object list pages (e.g. /objects/contacts, /objects/deals)
    const objectMatch = pathname.match(/^\/objects\/([^/]+)$/);
    if (objectMatch) {
      const slug = objectMatch[1];
      const obj = objects.find((o) => o.slug === slug);
      if (obj) {
        addRecentPage({
          key: `/objects/${slug}`,
          label: obj.pluralName,
          path: `/objects/${slug}`,
          icon: obj.icon,
          visitedAt: Date.now(),
        });
      }
      return;
    }

    // Check for record detail pages → track the parent object list
    const detailMatch = pathname.match(/^\/objects\/([^/]+)\/[^/]+$/);
    if (detailMatch) {
      const slug = detailMatch[1];
      const obj = objects.find((o) => o.slug === slug);
      if (obj) {
        addRecentPage({
          key: `/objects/${slug}`,
          label: obj.pluralName,
          path: `/objects/${slug}`,
          icon: obj.icon,
          visitedAt: Date.now(),
        });
      }
      return;
    }

    // Static pages
    const staticPage = STATIC_PAGES[pathname];
    if (staticPage) {
      addRecentPage({
        key: pathname,
        label: staticPage.label,
        path: pathname,
        icon: staticPage.icon,
        visitedAt: Date.now(),
      });
    }
  }, [pathname, objects, addRecentPage]);
}

function useMeetingSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const ipc = (
      window as Window & {
        electron?: {
          ipcRenderer?: {
            on: (channel: string, cb: (...args: unknown[]) => void) => void;
            removeListener: (channel: string, cb: (...args: unknown[]) => void) => void;
          };
        };
      }
    ).electron?.ipcRenderer;
    if (!ipc) return;

    const dataChangedHandler = (_e: unknown, queryKeys: string[]) => {
      for (const key of queryKeys) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    };

    const notificationHandler = (
      _e: unknown,
      payload: { title?: string },
    ) => {
      if (
        typeof payload?.title === "string" &&
        payload.title.toLowerCase().includes("meeting")
      ) {
        void qc.invalidateQueries({ queryKey: ["meetings"] });
      }
    };

    ipc.on("data-changed", dataChangedHandler);
    ipc.on("push-notification", notificationHandler);
    return () => {
      ipc.removeListener("data-changed", dataChangedHandler);
      ipc.removeListener("push-notification", notificationHandler);
    };
  }, [qc]);
}

export function AppLayout() {
  useTrackPageVisits();
  useMeetingSync();

  return (
    <SidebarProvider>
      <PageHeaderProvider>
        <div className="flex h-svh flex-col bg-surface-canvas">
          {/* Full-width header — independent of sidebar state */}
          <LayoutHeader />
          {/* Body row: sidebar + content */}
          <div className="flex flex-1 min-h-0">
            <AppSidebar />
            <SidebarInset className="flex flex-1 min-h-0 flex-col">
              <LayoutContent />
            </SidebarInset>
          </div>
        </div>
      </PageHeaderProvider>
    </SidebarProvider>
  );
}
