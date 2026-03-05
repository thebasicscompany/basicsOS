export const ROUTES = {
  // Apps
  CRM: "/dashboard",
  CHAT: "/chat",
  VOICE: "/voice",
  MCP: "/mcp",
  CONNECTIONS: "/connections",
  TASKS: "/tasks",
  NOTES: "/notes",
  // Automations
  AUTOMATIONS: "/automations",
  // User
  PROFILE: "/profile",
  SETTINGS: "/settings",
  IMPORT: "/import",
  // Admin
  ADMIN_USAGE: "/admin/usage",
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
