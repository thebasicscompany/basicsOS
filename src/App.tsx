import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ROUTES } from "@basics-os/hub";
import { AutomationsApp } from "@basics-os/automations";
import { VoiceApp } from "@basics-os/voice";
import { MCPViewerApp } from "@basics-os/mcp-viewer";

import { GatewayProvider } from "@/providers/GatewayProvider";
import { ObjectRegistryProvider } from "@/providers/ObjectRegistryProvider";
import { ErrorFallback } from "@/components/error-fallback";
import { ProtectedRoute } from "@/lib/auth";
import { StartPage } from "@/components/auth/start-page";
import { SignupPage } from "@/components/auth/signup-page";
import { HomePage } from "@/components/pages/HomePage";
import { ProfilePage } from "@/components/pages/ProfilePage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { UsagePage } from "@/components/pages/UsagePage";
import { ImportPage } from "@/components/pages/ImportPage";
import { ChatPage } from "@/components/pages/ChatPage";
import { TasksPage } from "@/components/pages/TasksPage";
import { NotesPage } from "@/components/pages/NotesPage";
import { CommandPalette } from "@/components/command-palette";
import { ObjectListPage } from "@/components/pages/ObjectListPage";
import { RecordDetailPage } from "@/components/pages/RecordDetailPage";
import { AppLayout } from "@/layouts/AppLayout";

function RedirectToSettingsConnections() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  const to = qs ? `/settings?${qs}#connections` : "/settings#connections";
  return <Navigate to={to} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

/**
 * Application entry point.
 *
 * Architecture:
 *   - QueryClientProvider: shared TanStack Query client
 *   - BrowserRouter: top-level router
 *   - Public routes: / (StartPage), /sign-up (SignupPage)
 *   - Protected routes: inside AppLayout via ProtectedRoute
 */
function AppRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      resetKeys={[location.pathname]}
    >
      <GatewayProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<StartPage />} />
          <Route path="/sign-up" element={<SignupPage />} />

          {/* Protected — all inside AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <ObjectRegistryProvider>
                  <>
                    <AppLayout />
                    <CommandPalette />
                  </>
                </ObjectRegistryProvider>
              </ProtectedRoute>
            }
          >
            <Route path={ROUTES.CRM} element={<HomePage />} />
            <Route
              path={`${ROUTES.AUTOMATIONS}/*`}
              element={<AutomationsApp />}
            />
            <Route path={ROUTES.VOICE} element={<VoiceApp />} />
            <Route path={ROUTES.MCP} element={<MCPViewerApp />} />
            <Route path={ROUTES.CHAT} element={<ChatPage />} />
            <Route path={ROUTES.CHAT_THREAD} element={<ChatPage />} />
            <Route path={ROUTES.PROFILE} element={<ProfilePage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            <Route path={ROUTES.ADMIN_USAGE} element={<UsagePage />} />
            <Route
              path={ROUTES.CONNECTIONS}
              element={<RedirectToSettingsConnections />}
            />
            <Route path={ROUTES.TASKS} element={<TasksPage />} />
            <Route path={ROUTES.NOTES} element={<NotesPage />} />
            <Route path={ROUTES.IMPORT} element={<ImportPage />} />

            {/* Records (object-registry backed objects) */}
            <Route path="/objects/:objectSlug" element={<ObjectListPage />} />
            <Route
              path="/objects/:objectSlug/:recordId"
              element={<RecordDetailPage />}
            />

            {/* Legacy dashboard redirect */}
            <Route
              path="/dashboard"
              element={<Navigate to="/home" replace />}
            />

            {/* Redirects: old CRM routes → new objects routes */}
            <Route
              path="/contacts"
              element={<Navigate to="/objects/contacts" replace />}
            />
            <Route
              path="/contacts/:id"
              element={<Navigate to="/objects/contacts" replace />}
            />
            <Route
              path="/companies"
              element={<Navigate to="/objects/companies" replace />}
            />
            <Route
              path="/companies/:id"
              element={<Navigate to="/objects/companies" replace />}
            />
            <Route
              path="/deals"
              element={<Navigate to="/objects/deals" replace />}
            />
            <Route
              path="/deals/:id"
              element={<Navigate to="/objects/deals" replace />}
            />

            {/* Catch-all: redirect to dashboard */}
            <Route path="*" element={<Navigate to={ROUTES.CRM} replace />} />
          </Route>
        </Routes>
      </GatewayProvider>
    </ErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
