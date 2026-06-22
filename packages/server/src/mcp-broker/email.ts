// email.send — send an email FROM BasicsOS (a platform address via Resend), with
// NO per-user connection. Use for notifying the user / internal digests &
// summaries ("email me ..."). To send AS the user from their own mailbox (e.g.
// emailing an external contact on their behalf), use connection.execute with
// GMAIL_SEND_EMAIL instead. Backed by the gateway's /v1/email/send (platform key).

import type { Env } from "@/env.js";
import type { BrokerTool } from "@/mcp-broker/protocol.js";
import { BrokerError } from "@/mcp-broker/protocol.js";
import { callGateway } from "@/mcp-broker/connections.js";

export function buildEmailTools(env: Env): BrokerTool[] {
  return [
    {
      name: "email.send",
      description:
        "Send an email FROM BasicsOS (the system address, no connection needed). Use for notifying the user or sending digests/summaries to them ('email me ...'). For emailing an EXTERNAL person AS the user, use connection.execute with gmail GMAIL_SEND_EMAIL instead.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "recipient email address" },
          subject: { type: "string" },
          content: { type: "string", description: "plain-text body" },
        },
        required: ["to", "subject", "content"],
        additionalProperties: false,
      },
      meta: { source: "system", writes: true },
      handle: async (args, ctx) => {
        const to = String(args.to ?? "").trim();
        const subject = String(args.subject ?? "").trim();
        const content = String(args.content ?? "");
        if (!to || !subject || !content) {
          throw new BrokerError("VALIDATION", "`to`, `subject`, and `content` are required.");
        }
        return callGateway(env, ctx, "POST", "/v1/email/send", { to, subject, content });
      },
    },
  ];
}
