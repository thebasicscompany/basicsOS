import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { moduleConfig } from "@basicsos/db";

type ModuleDefinition = {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  activeByDefault: boolean;
};

const BUILT_IN_MODULES: ModuleDefinition[] = [
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
];

export const modulesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) return BUILT_IN_MODULES.map((m) => ({ ...m, enabled: m.activeByDefault }));

    // Fetch persisted overrides for this tenant.
    const overrides = await ctx.db
      .select()
      .from(moduleConfig)
      .where(eq(moduleConfig.tenantId, ctx.tenantId));

    const overrideMap = new Map(overrides.map((o) => [o.moduleName, o.enabled]));

    return BUILT_IN_MODULES.map((m) => ({
      ...m,
      enabled: overrideMap.has(m.name)
        ? (overrideMap.get(m.name) ?? m.activeByDefault)
        : m.activeByDefault,
    }));
  }),

  getStatus: protectedProcedure
    .input(z.object({ moduleName: z.string() }))
    .query(async ({ ctx, input }) => {
      const module = BUILT_IN_MODULES.find((m) => m.name === input.moduleName);
      if (!module) return null;

      if (!ctx.tenantId) return { ...module, enabled: module.activeByDefault };

      const [override] = await ctx.db
        .select()
        .from(moduleConfig)
        .where(
          and(
            eq(moduleConfig.tenantId, ctx.tenantId),
            eq(moduleConfig.moduleName, input.moduleName),
          ),
        );

      return { ...module, enabled: override ? override.enabled : module.activeByDefault };
    }),

  setEnabled: adminProcedure
    .input(z.object({ moduleName: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const module = BUILT_IN_MODULES.find((m) => m.name === input.moduleName);
      if (!module) return { moduleName: input.moduleName, enabled: input.enabled };

      // Upsert: insert or update the override row.
      await ctx.db
        .insert(moduleConfig)
        .values({
          tenantId: ctx.tenantId,
          moduleName: input.moduleName,
          enabled: input.enabled,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [moduleConfig.tenantId, moduleConfig.moduleName],
          set: { enabled: input.enabled, updatedAt: new Date() },
        });

      return { moduleName: input.moduleName, enabled: input.enabled };
    }),
});
