// Client for the app-facing broker path (APP-0). The declarative renderer (APP-2)
// and the sandbox bridge (APP-4b) call broker tools through these, scoped to the
// app's slug → the server gates each call to the app's app_config.permissions and
// runs it as the logged-in user. Returns are the same data the agent sees.
import { fetchApi } from "@/lib/api";

export interface BrokerToolWire {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** MCP CallToolResult as returned by POST /api/apps/:slug/tools/call. */
interface BrokerCallResult {
  content: Array<{ type: string; text?: string }>;
  isError: boolean;
}

/** A broker error surfaced from a tool result (stable code from the contract). */
export class BrokerCallError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "BrokerCallError";
    this.code = code;
  }
}

/** The granted tool surface for this app (tools.list). */
export async function listAppTools(slug: string): Promise<BrokerToolWire[]> {
  const res = await fetchApi<{ tools: BrokerToolWire[] }>(
    `/api/apps/${encodeURIComponent(slug)}/tools`,
  );
  return res.tools ?? [];
}

/**
 * Call a broker tool through the app-facing path. Returns the parsed JSON payload
 * from the tool result; throws BrokerCallError (with the stable code, e.g.
 * FORBIDDEN / VALIDATION / NOT_FOUND) on a tool-level error.
 */
export async function callAppTool(
  slug: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const res = await fetchApi<BrokerCallResult>(
    `/api/apps/${encodeURIComponent(slug)}/tools/call`,
    { method: "POST", body: JSON.stringify({ name, arguments: args }) },
  );
  const text = res.content?.[0]?.text ?? "null";
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  if (res.isError) {
    const err = (payload as { error?: { code?: string; message?: string } })?.error;
    throw new BrokerCallError(err?.message ?? "Tool call failed", err?.code);
  }
  return payload;
}
