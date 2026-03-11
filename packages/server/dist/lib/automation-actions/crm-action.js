import * as schema from "@/db/schema/index.js";
import { eq, and } from "drizzle-orm";
async function getOrganizationIdForUser(db, crmUserId) {
    const [crmUser] = await db
        .select({ organizationId: schema.crmUsers.organizationId })
        .from(schema.crmUsers)
        .where(eq(schema.crmUsers.id, crmUserId))
        .limit(1);
    if (!crmUser?.organizationId) {
        throw new Error("CRM user is not associated with an organization");
    }
    return crmUser.organizationId;
}
export async function executeCrmAction(config, _context, db, crmUserId) {
    const { action, params = {} } = config;
    const organizationId = await getOrganizationIdForUser(db, crmUserId);
    switch (action) {
        case "create_task": {
            const { text, type, dueDate, contactId } = params;
            if (!contactId)
                throw new Error("create_task requires a contactId");
            const [contact] = await db
                .select({ id: schema.contacts.id })
                .from(schema.contacts)
                .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.organizationId, organizationId)))
                .limit(1);
            if (!contact)
                throw new Error(`Contact ${contactId} not found or access denied`);
            const [task] = await db.insert(schema.tasks).values({
                crmUserId,
                organizationId,
                text: text ?? "",
                type: type ?? "Todo",
                dueDate: dueDate ? new Date(dueDate) : null,
                contactId,
            }).returning();
            return { crm_result: task };
        }
        case "create_contact": {
            const { firstName, lastName, email, status: _status } = params;
            const [contact] = await db.insert(schema.contacts).values({
                crmUserId,
                organizationId,
                firstName: firstName ?? null,
                lastName: lastName ?? null,
                email: email ?? null,
            }).returning();
            return { crm_result: contact };
        }
        case "create_note": {
            const { contactId, text, status } = params;
            if (!contactId)
                throw new Error("create_note requires a contactId");
            const [contact] = await db
                .select({ id: schema.contacts.id })
                .from(schema.contacts)
                .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.organizationId, organizationId)))
                .limit(1);
            if (!contact)
                throw new Error(`Contact ${contactId} not found or access denied`);
            const [note] = await db.insert(schema.contactNotes).values({
                crmUserId,
                organizationId,
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
            const [deal] = await db
                .select({ id: schema.deals.id })
                .from(schema.deals)
                .where(and(eq(schema.deals.id, dealId), eq(schema.deals.organizationId, organizationId)))
                .limit(1);
            if (!deal)
                throw new Error(`Deal ${dealId} not found or access denied`);
            const [note] = await db.insert(schema.dealNotes).values({
                crmUserId,
                organizationId,
                dealId,
                text: text ?? "",
                type: type ?? null,
                date: new Date(),
            }).returning();
            return { crm_result: note };
        }
        case "update_deal": {
            const { dealId: rawDealId, status, name, amount } = params;
            const dealId = typeof rawDealId === "string" ? parseInt(rawDealId, 10) : rawDealId;
            if (dealId == null || Number.isNaN(dealId)) {
                throw new Error("update_deal requires a valid dealId (use {{trigger_data.id}} for deal.created)");
            }
            const updates = {};
            if (status !== undefined && status !== "")
                updates.status = status;
            if (name !== undefined && name !== "")
                updates.name = name;
            if (amount !== undefined && amount !== "") {
                const amountNum = typeof amount === "string" ? parseInt(amount, 10) : amount;
                if (!Number.isNaN(amountNum))
                    updates.amount = amountNum;
            }
            if (Object.keys(updates).length === 0) {
                throw new Error("update_deal requires at least one field to update (status, name, amount)");
            }
            const [deal] = await db
                .update(schema.deals)
                .set(updates)
                .where(and(eq(schema.deals.id, dealId), eq(schema.deals.organizationId, organizationId)))
                .returning();
            if (!deal)
                throw new Error(`Deal ${dealId} not found or access denied`);
            return { crm_result: deal };
        }
        default:
            throw new Error(`Unknown CRM action: ${action}`);
    }
}
