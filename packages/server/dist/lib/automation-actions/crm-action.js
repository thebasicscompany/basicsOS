import * as schema from "../../db/schema/index.js";
import { eq, and } from "drizzle-orm";
export async function executeCrmAction(config, _context, db, crmUserId) {
    const { action, params = {} } = config;
    switch (action) {
        case "create_task": {
            const { text, type, dueDate, contactId } = params;
            if (!contactId)
                throw new Error("create_task requires a contactId");
            const [task] = await db.insert(schema.tasks).values({
                crmUserId,
                text: text ?? "",
                type: type ?? "Todo",
                dueDate: dueDate ? new Date(dueDate) : null,
                contactId,
            }).returning();
            return { crm_result: task };
        }
        case "create_contact": {
            const { firstName, lastName, email, status } = params;
            const [contact] = await db.insert(schema.contacts).values({
                crmUserId,
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
            const { contactId, text, status } = params;
            if (!contactId)
                throw new Error("create_note requires a contactId");
            const [note] = await db.insert(schema.contactNotes).values({
                crmUserId,
                contactId,
                text: text ?? "",
                status: status ?? "none",
                date: new Date(),
            }).returning();
            return { crm_result: note };
        }
        case "create_deal_note": {
            const { dealId: rawDealId, text, type } = params;
            const dealId = typeof rawDealId === "string" ? parseInt(rawDealId, 10) : rawDealId;
            if (dealId == null || Number.isNaN(dealId)) {
                throw new Error("create_deal_note requires a valid dealId (use {{trigger_data.id}} for deal.created)");
            }
            const [note] = await db.insert(schema.dealNotes).values({
                crmUserId,
                dealId,
                text: text ?? "",
                type: type ?? null,
                date: new Date(),
            }).returning();
            return { crm_result: note };
        }
        case "update_deal": {
            const { dealId: rawDealId, stage, name, category, amount, description } = params;
            const dealId = typeof rawDealId === "string" ? parseInt(rawDealId, 10) : rawDealId;
            if (dealId == null || Number.isNaN(dealId)) {
                throw new Error("update_deal requires a valid dealId (use {{trigger_data.id}} for deal.created)");
            }
            const updates = {};
            if (stage !== undefined && stage !== "")
                updates.stage = stage;
            if (name !== undefined && name !== "")
                updates.name = name;
            if (category !== undefined && category !== "")
                updates.category = category;
            if (amount !== undefined && amount !== "") {
                const amountNum = typeof amount === "string" ? parseInt(amount, 10) : amount;
                if (!Number.isNaN(amountNum))
                    updates.amount = amountNum;
            }
            if (description !== undefined)
                updates.description = description;
            if (Object.keys(updates).length === 0) {
                throw new Error("update_deal requires at least one field to update (stage, name, category, amount, description)");
            }
            const [deal] = await db
                .update(schema.deals)
                .set(updates)
                .where(and(eq(schema.deals.id, dealId), eq(schema.deals.crmUserId, crmUserId)))
                .returning();
            if (!deal)
                throw new Error(`Deal ${dealId} not found or access denied`);
            return { crm_result: deal };
        }
        default:
            throw new Error(`Unknown CRM action: ${action}`);
    }
}
