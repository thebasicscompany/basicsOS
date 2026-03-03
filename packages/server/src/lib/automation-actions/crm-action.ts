import type { Db } from "../../db/client.js";
import * as schema from "../../db/schema/index.js";

export async function executeCrmAction(
  config: Record<string, unknown>,
  _context: Record<string, unknown>,
  db: Db,
  salesId: number,
): Promise<Record<string, unknown>> {
  const { action, params = {} } = config as {
    action: string;
    params?: Record<string, unknown>;
  };

  switch (action) {
    case "create_task": {
      const { text, type, dueDate, contactId } = params as {
        text?: string;
        type?: string;
        dueDate?: string;
        contactId?: number;
      };

      if (!contactId) throw new Error("create_task requires a contactId");

      const [task] = await db.insert(schema.tasks).values({
        salesId,
        text: text ?? "",
        type: type ?? "Todo",
        dueDate: dueDate ? new Date(dueDate) : null,
        contactId,
      }).returning();
      return { crm_result: task };
    }

    case "create_contact": {
      const { firstName, lastName, email, status } = params as {
        firstName?: string;
        lastName?: string;
        email?: string;
        status?: string;
      };

      const [contact] = await db.insert(schema.contacts).values({
        salesId,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        email: email ?? null,
        status: status ?? "cold",
        firstSeen: new Date(),
        lastSeen: new Date(),
      }).returning();
      return { crm_result: contact };
    }

    case "create_note": {
      const { contactId, text, status } = params as {
        contactId?: number;
        text?: string;
        status?: string;
      };

      if (!contactId) throw new Error("create_note requires a contactId");

      const [note] = await db.insert(schema.contactNotes).values({
        salesId,
        contactId,
        text: text ?? "",
        status: status ?? "none",
        date: new Date(),
      }).returning();
      return { crm_result: note };
    }

    case "create_deal_note": {
      const { dealId: rawDealId, text, type } = params as {
        dealId?: number | string;
        text?: string;
        type?: string;
      };

      const dealId = typeof rawDealId === "string" ? parseInt(rawDealId, 10) : rawDealId;
      if (dealId == null || Number.isNaN(dealId)) {
        throw new Error("create_deal_note requires a valid dealId (use {{trigger_data.id}} for deal.created)");
      }

      const [note] = await db.insert(schema.dealNotes).values({
        salesId,
        dealId,
        text: text ?? "",
        type: type ?? null,
        date: new Date(),
      }).returning();
      return { crm_result: note };
    }

    default:
      throw new Error(`Unknown CRM action: ${action}`);
  }
}
