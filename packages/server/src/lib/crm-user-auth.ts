import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema/index.js";
import { resolveStoredApiKey } from "./api-key-crypto.js";

export type CrmUserWithApiKey = {
  crmUser: typeof schema.crmUsers.$inferSelect;
  apiKey: string;
};

type CrmUserAuthResult =
  | { ok: true; data: CrmUserWithApiKey }
  | { ok: false; response: Response };

export async function resolveCrmUserWithApiKey(
  c: Context,
  db: Db
): Promise<CrmUserAuthResult> {
  const session = c.get("session") as { user?: { id?: string } } | undefined;
  const userId = session?.user?.id;

  if (!userId) {
    return {
      ok: false,
      response: c.json({ error: "Unauthorized" }, 401),
    };
  }

  const crmUserRows = await db
    .select()
    .from(schema.crmUsers)
    .where(eq(schema.crmUsers.userId, userId))
    .limit(1);

  const crmUser = crmUserRows[0];
  if (!crmUser) {
    return {
      ok: false,
      response: c.json({ error: "User not found in CRM" }, 404),
    };
  }

  const apiKey = resolveStoredApiKey(crmUser);

  if (!apiKey) {
    return {
      ok: false,
      response: c.json(
        { error: "Basics API key not configured. Add your key in Settings." },
        400
      ),
    };
  }

  return {
    ok: true,
    data: { crmUser, apiKey },
  };
}
