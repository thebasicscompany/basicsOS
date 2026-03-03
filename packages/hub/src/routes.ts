export const ROUTES = {
  // Apps
  CRM: "/dashboard",
  CHAT: "/chat",
  VOICE: "/voice",
  MCP: "/mcp",
  CONNECTIONS: "/connections",
  TASKS: "/tasks",
  // Automations (base + sub-routes for sidebar)
  AUTOMATIONS: "/automations",
  AUTOMATIONS_RUNS: "/automations/runs",
  AUTOMATIONS_LOGS: "/automations/logs",
  // User
  PROFILE: "/profile",
  SETTINGS: "/settings",
  IMPORT: "/import",
  // Records (dynamic /objects/:slug)
  OBJECTS: "/objects",
  OBJECTS_SLUG: "/objects/:slug",
  OBJECTS_SLUG_DETAIL: "/objects/:slug/:id",
  // Legacy (redirects)
  CRM_COMPANIES: "/companies",
  CRM_COMPANY_DETAIL: "/companies/:id",
  CRM_CONTACTS: "/contacts",
  CRM_CONTACT_DETAIL: "/contacts/:id",
  CRM_DEALS: "/deals",
  CRM_DEAL_DETAIL: "/deals/:id",
} as const;
