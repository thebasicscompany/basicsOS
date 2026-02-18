import { z } from "zod";

export const moduleManifestSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  displayName: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  icon: z.string(),
  defaultFields: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["text", "number", "boolean", "date", "uuid", "jsonb"]),
      required: z.boolean().default(false),
    }),
  ),
  activeByDefault: z.boolean().default(false),
  platforms: z.array(z.enum(["web", "desktop", "mobile"])).default(["web"]),
  hasMCPTool: z.boolean().default(false),
});

export type ModuleManifestInput = z.infer<typeof moduleManifestSchema>;
