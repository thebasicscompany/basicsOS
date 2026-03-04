import * as schema from "../db/schema/index.js";
import { eq, and, isNull } from "drizzle-orm";
export const ASSISTANT_TOOLS = [
    {
        type: "function",
        function: {
            name: "create_task",
            description: "Create a new task for a contact. Use when the user wants to add a follow-up task, reminder, or to-do for a contact.",
            parameters: {
                type: "object",
                properties: {
                    contact_id: {
                        type: "number",
                        description: "The ID of the contact to create the task for",
                    },
                    text: {
                        type: "string",
                        description: "Description of the task",
                    },
                    type: {
                        type: "string",
                        description: "Task type (e.g. call, email, meeting)",
                        default: "call",
                    },
                    due_date: {
                        type: "string",
                        description: "Due date in ISO 8601 format (e.g. 2025-02-28T12:00:00Z)",
                    },
                },
                required: ["contact_id", "text"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "add_note",
            description: "Add a note to a contact or deal. Use when the user wants to record a note, comment, or update about a contact or deal.",
            parameters: {
                type: "object",
                properties: {
                    contact_id: {
                        type: "number",
                        description: "The ID of the contact to add the note to",
                    },
                    deal_id: {
                        type: "number",
                        description: "The ID of the deal to add the note to",
                    },
                    text: {
                        type: "string",
                        description: "The note content",
                    },
                },
                required: ["text"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_deal",
            description: "Update a deal's stage or other fields. Use when the user wants to change deal status, stage, or other attributes.",
            parameters: {
                type: "object",
                properties: {
                    deal_id: {
                        type: "number",
                        description: "The ID of the deal to update",
                    },
                    stage: {
                        type: "string",
                        description: "The new stage for the deal",
                    },
                },
                required: ["deal_id"],
            },
        },
    },
];
export async function executeAssistantToolDrizzle(db, crmUserId, organizationId, toolName, args) {
    try {
        if (toolName === "create_task") {
            const contactId = args.contact_id;
            const text = args.text;
            const type = args.type ?? "call";
            const dueDate = args.due_date ??
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const [contact] = await db
                .select({ id: schema.contacts.id })
                .from(schema.contacts)
                .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.organizationId, organizationId)))
                .limit(1);
            if (!contact)
                return "Error: Contact not found";
            const [data] = await db
                .insert(schema.tasks)
                .values({
                contactId,
                crmUserId,
                organizationId,
                type,
                text,
                dueDate: new Date(dueDate),
            })
                .returning({ id: schema.tasks.id });
            if (!data) {
                return "Error: Failed to create task";
            }
            return `Task created successfully (id: ${data.id})`;
        }
        if (toolName === "add_note") {
            const contactId = args.contact_id;
            const dealId = args.deal_id;
            const text = args.text;
            if (contactId) {
                const [contact] = await db
                    .select({ id: schema.contacts.id })
                    .from(schema.contacts)
                    .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.organizationId, organizationId)))
                    .limit(1);
                if (!contact)
                    return "Error: Contact not found";
                const [data] = await db
                    .insert(schema.contactNotes)
                    .values({
                    contactId,
                    crmUserId,
                    organizationId,
                    text,
                })
                    .returning({ id: schema.contactNotes.id });
                if (!data) {
                    return "Error: Failed to add note";
                }
                return `Note added to contact (id: ${data.id})`;
            }
            if (dealId) {
                const [deal] = await db
                    .select({ id: schema.deals.id })
                    .from(schema.deals)
                    .where(and(eq(schema.deals.id, dealId), eq(schema.deals.organizationId, organizationId)))
                    .limit(1);
                if (!deal)
                    return "Error: Deal not found";
                const [data] = await db
                    .insert(schema.dealNotes)
                    .values({
                    dealId,
                    crmUserId,
                    organizationId,
                    text,
                })
                    .returning();
                if (!data) {
                    return "Error: Failed to add note";
                }
                return `Note added to deal (id: ${data.id})`;
            }
            return "Error: Must specify contact_id or deal_id";
        }
        if (toolName === "update_deal") {
            const dealId = args.deal_id;
            const stage = args.stage;
            const updateData = {
                updatedAt: new Date(),
            };
            if (stage)
                updateData.stage = stage;
            const [updated] = await db
                .update(schema.deals)
                .set(updateData)
                .where(and(eq(schema.deals.id, dealId), eq(schema.deals.organizationId, organizationId), isNull(schema.deals.archivedAt)))
                .returning();
            if (!updated) {
                return "Error: Deal not found or update failed";
            }
            return `Deal updated successfully`;
        }
        return `Unknown tool: ${toolName}`;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[assistant] tool execution error:", err);
        return `Error: ${msg}`;
    }
}
