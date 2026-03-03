import { Outlet, useLocation } from "react-router"
import { ErrorBoundary } from "react-error-boundary"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AppSidebar } from "@/components/app-sidebar"
import { PageHeaderProvider, usePageHeaderTitle } from "@/contexts/page-header"

function PageErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error
  resetErrorBoundary: () => void
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
  )
}

function LayoutHeader() {
  const title = usePageHeaderTitle()
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        {title && (
          <span className="text-sm font-medium">{title}</span>
        )}
      </div>
    </header>
  )
}

function LayoutContent() {
  const location = useLocation()
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div
        className="flex w-full flex-1 flex-col px-4 min-h-0"
        id="main-content"
      >
        <ErrorBoundary
          key={location.pathname}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <PageErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-svh flex-col min-w-0 overflow-hidden sm:transition-[width] sm:duration-200 sm:ease-linear">
        <PageHeaderProvider>
          <LayoutHeader />
          <LayoutContent />
        </PageHeaderProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
