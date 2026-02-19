import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { knowledgeRouter } from "./knowledge.js";
import { tasksRouter } from "./tasks.js";
import { crmRouter } from "./crm.js";
import { meetingsRouter } from "./meetings.js";
import { searchRouter } from "./search.js";
import { assistantRouter } from "./assistant.js";
import { modulesRouter } from "./modules.js";
import { automationsRouter } from "./automations.js";
import { hubRouter } from "./hub.js";
import { aiEmployeesRouter } from "./ai-employees.js";
import { adminRouter } from "./admin.js";
import { billingRouter } from "./billing.js";
import { llmKeysRouter } from "./llm-keys.js";

export const appRouter = router({
  auth: authRouter,
  knowledge: knowledgeRouter,
  tasks: tasksRouter,
  crm: crmRouter,
  meetings: meetingsRouter,
  search: searchRouter,
  assistant: assistantRouter,
  modules: modulesRouter,
  automations: automationsRouter,
  hub: hubRouter,
  aiEmployees: aiEmployeesRouter,
  admin: adminRouter,
  billing: billingRouter,
  llmKeys: llmKeysRouter,
});

export type AppRouter = typeof appRouter;
