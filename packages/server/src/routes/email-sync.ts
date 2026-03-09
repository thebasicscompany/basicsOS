import { Hono } from "hono";
import { eq, and, desc, sql, ilike, gte } from "drizzle-orm";
import { authMiddleware } from "@/middleware/auth.js";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import type { createAuth } from "@/auth.js";
import * as schema from "@/db/schema/index.js";
import { PERMISSIONS, requirePermission } from "@/lib/rbac.js";
import {
  triggerOrgSync,
  enqueueEnrichment,
} from "@/lib/email-sync/sync-engine.js";
import { logger } from "@/lib/logger.js";

const log = logger.child({ component: "email-sync-routes" });

type Auth = ReturnType<typeof createAuth>;

export function createEmailSyncRoutes(db: Db, auth: Auth, env: Env) {
  const app = new Hono();

  app.use("/*", authMiddleware(auth, db));

  /** Helper: get crmUser from session */
  const getCrmUser = async (c: any) => {
    const session = c.get("session") as { user?: { id?: string } } | undefined;
    const userId = session?.user?.id;
    if (!userId) return null;

    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);

    return crmUser ?? null;
  };

  // GET /api/email-sync/status
  app.get("/status", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    let syncState;
    try {
      [syncState] = await db
        .select()
        .from(schema.emailSyncState)
        .where(eq(schema.emailSyncState.organizationId, crmUser.organizationId))
        .limit(1);
    } catch (err) {
      log.error({ err }, "email-sync status: failed to query emailSyncState");
      return c.json({ error: "Failed to query sync state" }, 500);
    }

    if (!syncState) {
      return c.json({
        syncStatus: "not_started" as const,
        lastSyncedAt: null,
        totalSynced: 0,
        pendingSuggestions: 0,
        settings: {
          syncPeriodDays: 90,
          enrichWithAi: true,
          autoAcceptThreshold: null,
        },
      });
    }

    let pendingCount = 0;
    try {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.suggestedContacts)
        .where(
          and(
            eq(schema.suggestedContacts.organizationId, crmUser.organizationId),
            eq(schema.suggestedContacts.status, "pending"),
          ),
        );
      pendingCount = countResult?.count ?? 0;
    } catch (err) {
      log.error({ err }, "email-sync status: failed to count suggestions");
    }

    return c.json({
      syncStatus: syncState.syncStatus,
      lastSyncedAt: syncState.lastSyncedAt,
      totalSynced: syncState.totalSynced,
      pendingSuggestions: pendingCount,
      settings: syncState.settings,
    });
  });

  // POST /api/email-sync/start
  app.post("/start", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    // Check if already exists
    const [existing] = await db
      .select()
      .from(schema.emailSyncState)
      .where(eq(schema.emailSyncState.organizationId, crmUser.organizationId))
      .limit(1);

    if (existing) {
      return c.json({ ok: true, message: "Sync already active" });
    }

    await db.insert(schema.emailSyncState).values({
      organizationId: crmUser.organizationId,
      crmUserId: crmUser.id,
      syncStatus: "idle",
    });

    // Trigger first sync immediately
    await triggerOrgSync(crmUser.organizationId);

    return c.json({ ok: true });
  });

  // PUT /api/email-sync/settings
  app.put("/settings", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json<{
      syncPeriodDays?: number;
      enrichWithAi?: boolean;
      autoAcceptThreshold?: number | null;
    }>();

    const [syncState] = await db
      .select()
      .from(schema.emailSyncState)
      .where(eq(schema.emailSyncState.organizationId, crmUser.organizationId))
      .limit(1);

    if (!syncState) return c.json({ error: "Sync not started" }, 400);

    const currentSettings = syncState.settings as {
      syncPeriodDays: number;
      enrichWithAi: boolean;
      autoAcceptThreshold: number | null;
    };

    const newSettings = {
      syncPeriodDays: body.syncPeriodDays ?? currentSettings.syncPeriodDays,
      enrichWithAi: body.enrichWithAi ?? currentSettings.enrichWithAi,
      autoAcceptThreshold:
        body.autoAcceptThreshold !== undefined
          ? body.autoAcceptThreshold
          : currentSettings.autoAcceptThreshold,
    };

    await db
      .update(schema.emailSyncState)
      .set({ settings: newSettings })
      .where(eq(schema.emailSyncState.id, syncState.id));

    return c.json({ ok: true, settings: newSettings });
  });

  // POST /api/email-sync/trigger
  app.post("/trigger", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    await triggerOrgSync(crmUser.organizationId);
    return c.json({ ok: true });
  });

  // DELETE /api/email-sync
  app.delete("/", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    await db
      .delete(schema.emailSyncState)
      .where(eq(schema.emailSyncState.organizationId, crmUser.organizationId));

    return c.json({ ok: true });
  });

  // GET /api/email-sync/suggestions
  app.get("/suggestions", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const status = c.req.query("status") ?? "pending";
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("perPage") ?? "20", 10)),
    );
    const offset = (page - 1) * perPage;

    const conditions = [
      eq(schema.suggestedContacts.organizationId, crmUser.organizationId),
      eq(schema.suggestedContacts.status, status),
    ];

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.suggestedContacts)
      .where(and(...conditions));

    const suggestions = await db
      .select()
      .from(schema.suggestedContacts)
      .where(and(...conditions))
      .orderBy(desc(schema.suggestedContacts.score))
      .limit(perPage)
      .offset(offset);

    return c.json({
      data: suggestions,
      total: countResult?.count ?? 0,
      page,
      perPage,
    });
  });

  // POST /api/email-sync/suggestions/:id/accept
  app.post("/suggestions/:id/accept", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const suggestionId = parseInt(c.req.param("id"), 10);

    const [suggestion] = await db
      .select()
      .from(schema.suggestedContacts)
      .where(
        and(
          eq(schema.suggestedContacts.id, suggestionId),
          eq(schema.suggestedContacts.organizationId, crmUser.organizationId),
        ),
      )
      .limit(1);

    if (!suggestion) return c.json({ error: "Suggestion not found" }, 404);

    if (suggestion.status !== "pending")
      return c.json({ error: "Already reviewed" }, 400);

    // Check for existing contact with same email
    const [existingContact] = await db
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.organizationId, crmUser.organizationId),
          ilike(schema.contacts.email, suggestion.email),
        ),
      )
      .limit(1);

    if (existingContact) {
      // Just mark as accepted, contact already exists
      await db
        .update(schema.suggestedContacts)
        .set({ status: "accepted", reviewedAt: new Date() })
        .where(eq(schema.suggestedContacts.id, suggestionId));

      return c.json({ ok: true, contactId: existingContact.id });
    }

    // Resolve company from domain
    let companyId: number | null = null;
    if (suggestion.domain) {
      const [company] = await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(
          and(
            eq(schema.companies.organizationId, crmUser.organizationId),
            ilike(schema.companies.domain, suggestion.domain),
          ),
        )
        .limit(1);

      if (company) {
        companyId = company.id;
      } else if (suggestion.companyName) {
        // Try by name
        const [companyByName] = await db
          .select({ id: schema.companies.id })
          .from(schema.companies)
          .where(
            and(
              eq(schema.companies.organizationId, crmUser.organizationId),
              ilike(schema.companies.name, suggestion.companyName),
            ),
          )
          .limit(1);

        if (companyByName) {
          companyId = companyByName.id;
        }
      }
    }

    // Create contact
    const [newContact] = await db
      .insert(schema.contacts)
      .values({
        firstName: suggestion.firstName,
        lastName: suggestion.lastName,
        email: suggestion.email,
        companyId,
        crmUserId: crmUser.id,
        organizationId: crmUser.organizationId,
        customFields: {},
      })
      .returning({ id: schema.contacts.id });

    // Link all synced emails with this email
    const matchingEmails = await db
      .select({
        id: schema.syncedEmails.id,
        fromEmail: schema.syncedEmails.fromEmail,
      })
      .from(schema.syncedEmails)
      .where(
        and(
          eq(schema.syncedEmails.organizationId, crmUser.organizationId),
          sql`(${schema.syncedEmails.fromEmail} ILIKE ${suggestion.email} OR ${schema.syncedEmails.toAddresses}::text ILIKE ${"%" + suggestion.email + "%"})`,
        ),
      );

    for (const email of matchingEmails) {
      const role =
        email.fromEmail.toLowerCase() === suggestion.email.toLowerCase()
          ? "from"
          : "to";

      await db
        .insert(schema.emailContactLinks)
        .values({
          organizationId: crmUser.organizationId,
          syncedEmailId: email.id,
          contactId: newContact.id,
          role,
        })
        .onConflictDoNothing();
    }

    // Mark suggestion as accepted
    await db
      .update(schema.suggestedContacts)
      .set({ status: "accepted", reviewedAt: new Date() })
      .where(eq(schema.suggestedContacts.id, suggestionId));

    // Queue AI enrichment
    const settings = (
      await db
        .select({ settings: schema.emailSyncState.settings })
        .from(schema.emailSyncState)
        .where(eq(schema.emailSyncState.organizationId, crmUser.organizationId))
        .limit(1)
    )?.[0]?.settings as { enrichWithAi: boolean } | undefined;

    if (settings?.enrichWithAi) {
      await enqueueEnrichment(crmUser.organizationId, newContact.id);
    }

    return c.json({ ok: true, contactId: newContact.id });
  });

  // POST /api/email-sync/suggestions/:id/dismiss
  app.post("/suggestions/:id/dismiss", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const suggestionId = parseInt(c.req.param("id"), 10);

    await db
      .update(schema.suggestedContacts)
      .set({ status: "dismissed", reviewedAt: new Date() })
      .where(
        and(
          eq(schema.suggestedContacts.id, suggestionId),
          eq(schema.suggestedContacts.organizationId, crmUser.organizationId),
        ),
      );

    return c.json({ ok: true });
  });

  // POST /api/email-sync/suggestions/accept-all
  app.post("/suggestions/accept-all", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json<{ minScore?: number }>().catch(() => ({}));
    const minScore = (body as { minScore?: number }).minScore ?? 0;

    const pending = await db
      .select()
      .from(schema.suggestedContacts)
      .where(
        and(
          eq(schema.suggestedContacts.organizationId, crmUser.organizationId),
          eq(schema.suggestedContacts.status, "pending"),
          gte(schema.suggestedContacts.score, minScore),
        ),
      )
      .orderBy(desc(schema.suggestedContacts.score));

    let accepted = 0;
    for (const suggestion of pending) {
      // Check for existing contact
      const [existing] = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.organizationId, crmUser.organizationId),
            ilike(schema.contacts.email, suggestion.email),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(schema.suggestedContacts)
          .set({ status: "accepted", reviewedAt: new Date() })
          .where(eq(schema.suggestedContacts.id, suggestion.id));
        accepted++;
        continue;
      }

      // Resolve company
      let companyId: number | null = null;
      if (suggestion.domain) {
        const [company] = await db
          .select({ id: schema.companies.id })
          .from(schema.companies)
          .where(
            and(
              eq(schema.companies.organizationId, crmUser.organizationId),
              ilike(schema.companies.domain, suggestion.domain),
            ),
          )
          .limit(1);
        if (company) companyId = company.id;
      }

      const [newContact] = await db
        .insert(schema.contacts)
        .values({
          firstName: suggestion.firstName,
          lastName: suggestion.lastName,
          email: suggestion.email,
          companyId,
          crmUserId: crmUser.id,
          organizationId: crmUser.organizationId,
          customFields: {},
        })
        .returning({ id: schema.contacts.id });

      // Link emails
      const matchingEmails = await db
        .select({
          id: schema.syncedEmails.id,
          fromEmail: schema.syncedEmails.fromEmail,
        })
        .from(schema.syncedEmails)
        .where(
          and(
            eq(schema.syncedEmails.organizationId, crmUser.organizationId),
            sql`(${schema.syncedEmails.fromEmail} ILIKE ${suggestion.email} OR ${schema.syncedEmails.toAddresses}::text ILIKE ${"%" + suggestion.email + "%"})`,
          ),
        );

      for (const email of matchingEmails) {
        await db
          .insert(schema.emailContactLinks)
          .values({
            organizationId: crmUser.organizationId,
            syncedEmailId: email.id,
            contactId: newContact.id,
            role:
              email.fromEmail.toLowerCase() === suggestion.email.toLowerCase()
                ? "from"
                : "to",
          })
          .onConflictDoNothing();
      }

      await db
        .update(schema.suggestedContacts)
        .set({ status: "accepted", reviewedAt: new Date() })
        .where(eq(schema.suggestedContacts.id, suggestion.id));

      await enqueueEnrichment(crmUser.organizationId, newContact.id);
      accepted++;
    }

    return c.json({ ok: true, accepted });
  });

  // GET /api/email-sync/search — search emails for participants
  app.get("/search", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const q = (c.req.query("q") ?? "").trim();
    if (q.length < 2) return c.json({ data: [] });

    const orgId = crmUser.organizationId;
    const pattern = `%${q}%`;

    // Search synced_emails matching query
    const matchingEmails = await db
      .select({
        fromEmail: schema.syncedEmails.fromEmail,
        fromName: schema.syncedEmails.fromName,
        toAddresses: schema.syncedEmails.toAddresses,
        ccAddresses: schema.syncedEmails.ccAddresses,
        date: schema.syncedEmails.date,
      })
      .from(schema.syncedEmails)
      .where(
        and(
          eq(schema.syncedEmails.organizationId, orgId),
          sql`(
            ${schema.syncedEmails.fromEmail} ILIKE ${pattern}
            OR ${schema.syncedEmails.fromName} ILIKE ${pattern}
            OR ${schema.syncedEmails.subject} ILIKE ${pattern}
            OR ${schema.syncedEmails.snippet} ILIKE ${pattern}
          )`,
        ),
      )
      .orderBy(desc(schema.syncedEmails.date))
      .limit(200);

    // Extract unique email addresses with aggregated info
    const participantMap = new Map<
      string,
      {
        email: string;
        name: string | null;
        sentCount: number;
        receivedCount: number;
        lastDate: Date | null;
      }
    >();

    const updateParticipant = (
      email: string,
      name: string | null | undefined,
      date: Date,
      isSender: boolean,
    ) => {
      const key = email.toLowerCase();
      const existing = participantMap.get(key);
      if (existing) {
        if (isSender) existing.sentCount++;
        else existing.receivedCount++;
        if (!existing.lastDate || date > existing.lastDate)
          existing.lastDate = date;
        if (!existing.name && name) existing.name = name;
      } else {
        participantMap.set(key, {
          email,
          name: name ?? null,
          sentCount: isSender ? 1 : 0,
          receivedCount: isSender ? 0 : 1,
          lastDate: date,
        });
      }
    };

    for (const row of matchingEmails) {
      const date = new Date(row.date);
      updateParticipant(row.fromEmail, row.fromName, date, true);
      for (const addr of row.toAddresses ?? []) {
        updateParticipant(addr.email, addr.name, date, false);
      }
      for (const addr of row.ccAddresses ?? []) {
        updateParticipant(addr.email, addr.name, date, false);
      }
    }

    // Sort by total email count, take top 20
    const sorted = [...participantMap.values()]
      .map((p) => ({
        ...p,
        emailCount: p.sentCount + p.receivedCount,
        isBidirectional: p.sentCount > 0 && p.receivedCount > 0,
        domain: p.email.includes("@")
          ? p.email.split("@")[1].toLowerCase()
          : null,
      }))
      .sort((a, b) => b.emailCount - a.emailCount)
      .slice(0, 20);

    // Batch-check contacts table
    const emails = sorted.map((p) => p.email.toLowerCase());
    const existingContacts =
      emails.length > 0
        ? await db
            .select({
              id: schema.contacts.id,
              email: schema.contacts.email,
            })
            .from(schema.contacts)
            .where(
              and(
                eq(schema.contacts.organizationId, orgId),
                sql`LOWER(${schema.contacts.email}) = ANY(${emails})`,
              ),
            )
        : [];

    const contactByEmail = new Map(
      existingContacts.map((c) => [c.email?.toLowerCase(), c.id]),
    );

    // Batch-check suggested_contacts
    const existingSuggestions =
      emails.length > 0
        ? await db
            .select({
              id: schema.suggestedContacts.id,
              email: schema.suggestedContacts.email,
              score: schema.suggestedContacts.score,
              status: schema.suggestedContacts.status,
            })
            .from(schema.suggestedContacts)
            .where(
              and(
                eq(schema.suggestedContacts.organizationId, orgId),
                sql`LOWER(${schema.suggestedContacts.email}) = ANY(${emails})`,
              ),
            )
        : [];

    const suggestionByEmail = new Map(
      existingSuggestions.map((s) => [s.email.toLowerCase(), s]),
    );

    const data = sorted.map((p) => {
      const emailLower = p.email.toLowerCase();
      const contactId = contactByEmail.get(emailLower);
      const suggestion = suggestionByEmail.get(emailLower);

      let status: "new" | "in_crm" | "suggested" | "dismissed" = "new";
      if (contactId) status = "in_crm";
      else if (suggestion?.status === "dismissed") status = "dismissed";
      else if (suggestion) status = "suggested";

      return {
        email: p.email,
        name: p.name,
        domain: p.domain,
        emailCount: p.emailCount,
        lastEmailDate: p.lastDate?.toISOString() ?? null,
        isBidirectional: p.isBidirectional,
        status,
        ...(contactId && { contactId }),
        ...(suggestion && {
          suggestionId: suggestion.id,
          score: suggestion.score,
        }),
      };
    });

    return c.json({ data });
  });

  // POST /api/email-sync/add-contact — create contact from email search
  app.post("/add-contact", async (c) => {
    const authz = await requirePermission(c, db, PERMISSIONS.recordsWrite);
    if (!authz.ok) return authz.response;

    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json<{
      email: string;
      firstName?: string;
      lastName?: string;
      domain?: string;
    }>();

    if (!body.email) return c.json({ error: "email required" }, 400);

    const orgId = crmUser.organizationId;

    // Check if contact already exists
    const [existingContact] = await db
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.organizationId, orgId),
          ilike(schema.contacts.email, body.email),
        ),
      )
      .limit(1);

    if (existingContact) {
      return c.json({ ok: true, contactId: existingContact.id });
    }

    // Resolve company from domain
    let companyId: number | null = null;
    if (body.domain) {
      const [company] = await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(
          and(
            eq(schema.companies.organizationId, orgId),
            ilike(schema.companies.domain, body.domain),
          ),
        )
        .limit(1);

      if (company) companyId = company.id;
    }

    // Create contact
    const [newContact] = await db
      .insert(schema.contacts)
      .values({
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
        email: body.email,
        companyId,
        crmUserId: crmUser.id,
        organizationId: orgId,
        customFields: {},
      })
      .returning({ id: schema.contacts.id });

    // Link matching synced emails
    const emailPattern = `%${body.email}%`;
    const matchingEmails = await db
      .select({
        id: schema.syncedEmails.id,
        fromEmail: schema.syncedEmails.fromEmail,
      })
      .from(schema.syncedEmails)
      .where(
        and(
          eq(schema.syncedEmails.organizationId, orgId),
          sql`(${schema.syncedEmails.fromEmail} ILIKE ${body.email} OR ${schema.syncedEmails.toAddresses}::text ILIKE ${emailPattern})`,
        ),
      );

    for (const email of matchingEmails) {
      const role =
        email.fromEmail.toLowerCase() === body.email.toLowerCase()
          ? "from"
          : "to";
      await db
        .insert(schema.emailContactLinks)
        .values({
          organizationId: orgId,
          syncedEmailId: email.id,
          contactId: newContact.id,
          role,
        })
        .onConflictDoNothing();
    }

    // Update suggested_contacts status if row exists
    await db
      .update(schema.suggestedContacts)
      .set({ status: "accepted", reviewedAt: new Date() })
      .where(
        and(
          eq(schema.suggestedContacts.organizationId, orgId),
          ilike(schema.suggestedContacts.email, body.email),
          eq(schema.suggestedContacts.status, "pending"),
        ),
      );

    // Queue AI enrichment
    const settings = (
      await db
        .select({ settings: schema.emailSyncState.settings })
        .from(schema.emailSyncState)
        .where(eq(schema.emailSyncState.organizationId, orgId))
        .limit(1)
    )?.[0]?.settings as { enrichWithAi: boolean } | undefined;

    if (settings?.enrichWithAi) {
      await enqueueEnrichment(orgId, newContact.id);
    }

    return c.json({ ok: true, contactId: newContact.id });
  });

  // GET /api/email-sync/emails — emails for a contact
  app.get("/emails", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const contactId = parseInt(c.req.query("contactId") ?? "0", 10);
    if (!contactId) return c.json({ error: "contactId required" }, 400);

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(c.req.query("perPage") ?? "20", 10)),
    );
    const offset = (page - 1) * perPage;

    // Get email IDs linked to this contact
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.emailContactLinks)
      .where(
        and(
          eq(schema.emailContactLinks.contactId, contactId),
          eq(schema.emailContactLinks.organizationId, crmUser.organizationId),
        ),
      );

    const linkedEmails = await db
      .select({
        email: schema.syncedEmails,
        role: schema.emailContactLinks.role,
      })
      .from(schema.emailContactLinks)
      .innerJoin(
        schema.syncedEmails,
        eq(schema.emailContactLinks.syncedEmailId, schema.syncedEmails.id),
      )
      .where(
        and(
          eq(schema.emailContactLinks.contactId, contactId),
          eq(schema.emailContactLinks.organizationId, crmUser.organizationId),
        ),
      )
      .orderBy(desc(schema.syncedEmails.date))
      .limit(perPage)
      .offset(offset);

    return c.json({
      data: linkedEmails.map((le) => ({
        ...le.email,
        role: le.role,
      })),
      total: countResult?.count ?? 0,
      page,
      perPage,
    });
  });

  // GET /api/email-sync/emails/:id — single email detail
  app.get("/emails/:id", async (c) => {
    const crmUser = await getCrmUser(c);
    if (!crmUser?.organizationId) return c.json({ error: "Unauthorized" }, 401);

    const emailId = parseInt(c.req.param("id"), 10);

    const [email] = await db
      .select()
      .from(schema.syncedEmails)
      .where(
        and(
          eq(schema.syncedEmails.id, emailId),
          eq(schema.syncedEmails.organizationId, crmUser.organizationId),
        ),
      )
      .limit(1);

    if (!email) return c.json({ error: "Email not found" }, 404);

    return c.json(email);
  });

  return app;
}
