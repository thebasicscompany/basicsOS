import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";

const BUILT_IN_MODULES = [
  {
    name: "knowledge",
    displayName: "Knowledge Base",
    description: "Document management",
    icon: "📚",
    activeByDefault: true,
  },
  {
    name: "crm",
    displayName: "CRM",
    description: "Contact and deal management",
    icon: "🤝",
    activeByDefault: true,
  },
  {
    name: "tasks",
    displayName: "Tasks",
    description: "Task management",
    icon: "✅",
    activeByDefault: true,
  },
  {
    name: "meetings",
    displayName: "Meetings",
    description: "Meeting intelligence",
    icon: "🎯",
    activeByDefault: true,
  },
  {
    name: "hub",
    displayName: "Hub",
    description: "Integrations and links",
    icon: "🔗",
    activeByDefault: true,
  },
  {
    name: "ai-employees",
    displayName: "AI Employees",
    description: "Autonomous AI agents",
    icon: "🤖",
    activeByDefault: false,
  },
  {
    name: "automations",
    displayName: "Automations",
    description: "Workflow automation",
    icon: "⚡",
    activeByDefault: false,
  },
] as const;

export const modulesRouter = router({
  list: protectedProcedure.query(() => BUILT_IN_MODULES),

  getStatus: protectedProcedure
    .input(z.object({ moduleName: z.string() }))
    .query(({ input }) => {
      const module = BUILT_IN_MODULES.find((m) => m.name === input.moduleName);
      if (!module) return null;
      return { ...module, enabled: module.activeByDefault };
    }),

  setEnabled: adminProcedure
    .input(z.object({ moduleName: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => {
      return { moduleName: input.moduleName, enabled: input.enabled };
    }),
});
