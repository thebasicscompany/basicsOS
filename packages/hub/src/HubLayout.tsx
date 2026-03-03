import type { ReactNode } from "react";
import { Outlet, useLocation } from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { SidebarInset, SidebarProvider } from "basics-os/src/components/ui/sidebar";
import { cn } from "basics-os/src/lib/utils";
import { HubSidebar } from "./HubSidebar";

function PageErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6" role="alert">
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

export function HubLayout({
  children,
  extraNavContent,
}: {
  children?: ReactNode;
  extraNavContent?: ReactNode;
}) {
  const location = useLocation();
  return (
    <SidebarProvider>
      <HubSidebar extraNavContent={extraNavContent} />
      <SidebarInset
        className={cn(
          "flex h-svh flex-col min-w-0",
          "sm:transition-[width] sm:duration-200 sm:ease-linear",
        )}
      >
        <div className="flex flex-1 min-h-0 flex-col">
          <div
            className="mx-auto flex max-w-screen-xl flex-1 flex-col px-4 pt-4 min-h-0"
            id="main-content"
          >
            <ErrorBoundary
              key={location.pathname}
              fallbackRender={({ error, resetErrorBoundary }) => (
                <PageErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
              )}
            >
              {children ?? <Outlet />}
            </ErrorBoundary>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
