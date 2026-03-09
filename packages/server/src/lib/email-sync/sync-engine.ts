import { PgBoss } from "pg-boss";
import { eq, and, sql, ilike } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { logger } from "@/lib/logger.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";
import { buildGatewayHeaders, type AiKeyConfig } from "@/lib/org-ai-config.js";
import { scoreParticipant, shouldAutoExclude } from "./contact-scorer.js";
import { enrichContact } from "./ai-enrichment.js";

const log = logger.child({ component: "email-sync-engine" });

let _boss: PgBoss | null = null;
let _db: Db | null = null;
let _env: Env | null = null;

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  from: { email: string; name?: string };
  to: { email: string; name?: string }[];
  cc: { email: string; name?: string }[];
  date: string;
  isRead: boolean;
  labels: string[];
  headers: Record<string, string>;
}

interface SyncResponse {
  messages: GmailMessage[];
  historyId: string;
  nextPageToken?: string;
}

type SyncJobData = { organizationId: string };
type EnrichJobData = { organizationId: string; contactId: number };

export async function startEmailSyncEngine(
  database: Db,
  environment: Env,
): Promise<void> {
  _db = database;
  _env = environment;

  _boss = new PgBoss(environment.DATABASE_URL);
  _boss.on("error", (err: unknown) => {
    log.error({ err }, "pg-boss email-sync error");
  });

  await _boss.start();

  await _boss.createQueue("email-sync");
  await _boss.createQueue("email-enrich");
  await _boss.createQueue("email-sync-scheduler");

  // Schedule: check for orgs needing sync every 5 minutes
  await _boss.schedule("email-sync-scheduler", "*/5 * * * *", {}, {});
  await _boss.work<Record<string, unknown>>(
    "email-sync-scheduler",
    { batchSize: 1 },
    async () => {
      await enqueueAllOrgSyncs();
    },
  );

  // Worker for per-org sync jobs
  await _boss.work<SyncJobData>(
    "email-sync",
    { batchSize: 2 },
    async (jobs) => {
      for (const job of jobs) {
        await syncOrgEmails(job.data.organizationId);
      }
    },
  );

  // Worker for enrichment jobs
  await _boss.work<EnrichJobData>(
    "email-enrich",
    { batchSize: 3 },
    async (jobs) => {
      for (const job of jobs) {
        await enrichContact(
          _db!,
          _env!,
          job.data.organizationId,
          job.data.contactId,
        );
      }
    },
  );

  log.info("Email sync engine started");
}

export async function stopEmailSyncEngine(): Promise<void> {
  if (!_boss) return;
  try {
    await _boss.stop({ graceful: true, timeout: 30_000 });
    log.info("Email sync engine stopped");
  } catch (err) {
    log.error({ err }, "Email sync engine stop error");
  } finally {
    _boss = null;
  }
}

/** Enqueue enrichment job for a specific contact */
export async function enqueueEnrichment(
  orgId: string,
  contactId: number,
): Promise<void> {
  if (!_boss) return;
  await _boss.send("email-enrich", {
    organizationId: orgId,
    contactId,
  });
}

/** Manually trigger sync for an org */
export async function triggerOrgSync(orgId: string): Promise<void> {
  if (!_boss) return;
  await _boss.send(
    "email-sync",
    { organizationId: orgId },
    { singletonKey: `sync-${orgId}`, singletonSeconds: 60 },
  );
}

async function enqueueAllOrgSyncs(): Promise<void> {
  if (!_db || !_boss) return;

  const syncStates = await _db
    .select({ organizationId: schema.emailSyncState.organizationId })
    .from(schema.emailSyncState)
    .where(eq(schema.emailSyncState.syncStatus, "idle"));

  for (const state of syncStates) {
    await _boss.send(
      "email-sync",
      { organizationId: state.organizationId },
      { singletonKey: `sync-${state.organizationId}`, singletonSeconds: 240 },
    );
  }
}

async function syncOrgEmails(orgId: string): Promise<void> {
  if (!_db || !_env) return;

  // Get sync state
  const [syncState] = await _db
    .select()
    .from(schema.emailSyncState)
    .where(eq(schema.emailSyncState.organizationId, orgId))
    .limit(1);

  if (!syncState) return;

  // Update status to syncing
  await _db
    .update(schema.emailSyncState)
    .set({ syncStatus: "syncing", errorMessage: null })
    .where(eq(schema.emailSyncState.id, syncState.id));

  try {
    // Get AI config for gateway auth
    const aiConfig = await resolveAiConfigForOrg(_db, _env, orgId);
    if (!aiConfig) {
      await _db
        .update(schema.emailSyncState)
        .set({
          syncStatus: "error",
          errorMessage: "No AI configuration found",
        })
        .where(eq(schema.emailSyncState.id, syncState.id));
      return;
    }

    const headers = buildGatewayHeaders(aiConfig);

    // Resolve Better Auth userId from crmUserId for per-user gateway connections
    if (!syncState.crmUserId) {
      throw new Error("No crmUserId on sync state — cannot resolve user for gateway");
    }
    const [crmUser] = await _db
      .select({ userId: schema.crmUsers.userId })
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.id, syncState.crmUserId))
      .limit(1);
    if (!crmUser) {
      throw new Error(`CRM user ${syncState.crmUserId} not found`);
    }
    const betterAuthUserId = crmUser.userId;
    headers["X-User-Id"] = betterAuthUserId;

    const settings = syncState.settings as {
      syncPeriodDays: number;
      enrichWithAi: boolean;
      autoAcceptThreshold: number | null;
    };

    let totalNewEmails = 0;
    let nextPageToken: string | undefined;
    let newHistoryId = syncState.historyId;

    // Paginated sync
    do {
      const body: Record<string, unknown> = {
        mode: syncState.historyId ? "incremental" : "initial",
        syncPeriodDays: settings.syncPeriodDays,
        maxResults: 100,
      };
      if (nextPageToken) body.pageToken = nextPageToken;
      if (syncState.historyId) body.historyId = syncState.historyId;
      body.userId = betterAuthUserId;

      const res = await fetch(
        `${_env.BASICSOS_API_URL}/v1/execute/gmail/sync`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        },
      );

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
        log.warn({ orgId, retryAfter }, "Gmail sync rate limited");
        await _db
          .update(schema.emailSyncState)
          .set({ syncStatus: "idle" })
          .where(eq(schema.emailSyncState.id, syncState.id));
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gmail sync API error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as SyncResponse;
      newHistoryId = data.historyId;
      nextPageToken = data.nextPageToken;

      // Process messages
      const newCount = await processMessages(
        _db,
        orgId,
        data.messages,
        settings.autoAcceptThreshold,
      );
      totalNewEmails += newCount;
    } while (nextPageToken);

    // Update sync state
    await _db
      .update(schema.emailSyncState)
      .set({
        syncStatus: "idle",
        historyId: newHistoryId,
        lastSyncedAt: new Date(),
        totalSynced: sql`${schema.emailSyncState.totalSynced} + ${totalNewEmails}`,
        errorMessage: null,
      })
      .where(eq(schema.emailSyncState.id, syncState.id));

    log.info({ orgId, newEmails: totalNewEmails }, "Email sync completed");
  } catch (err) {
    log.error({ err, orgId }, "Email sync failed");
    await _db
      .update(schema.emailSyncState)
      .set({
        syncStatus: "error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      })
      .where(eq(schema.emailSyncState.id, syncState.id));
  }
}

async function processMessages(
  db: Db,
  orgId: string,
  messages: GmailMessage[],
  autoAcceptThreshold: number | null,
): Promise<number> {
  let inserted = 0;

  for (const msg of messages) {
    // Check List-Unsubscribe header → bulk mail → skip
    if (msg.headers?.["List-Unsubscribe"] || msg.headers?.["list-unsubscribe"]) {
      continue;
    }

    // Skip auto-excluded senders
    if (shouldAutoExclude(msg.from.email)) continue;

    // Upsert email
    const result = await db
      .insert(schema.syncedEmails)
      .values({
        organizationId: orgId,
        gmailMessageId: msg.id,
        gmailThreadId: msg.threadId,
        subject: msg.subject,
        snippet: msg.snippet,
        bodyText: msg.bodyText,
        fromEmail: msg.from.email.toLowerCase(),
        fromName: msg.from.name ?? null,
        toAddresses: msg.to ?? [],
        ccAddresses: msg.cc ?? [],
        date: new Date(msg.date),
        isRead: msg.isRead,
      })
      .onConflictDoNothing({
        target: [
          schema.syncedEmails.organizationId,
          schema.syncedEmails.gmailMessageId,
        ],
      })
      .returning({ id: schema.syncedEmails.id });

    if (result.length === 0) continue; // Already existed
    inserted++;

    const emailId = result[0].id;

    // Collect all participant emails from this message
    const participants = new Set<string>();
    participants.add(msg.from.email.toLowerCase());
    for (const to of msg.to ?? []) {
      participants.add(to.email.toLowerCase());
    }
    for (const cc of msg.cc ?? []) {
      participants.add(cc.email.toLowerCase());
    }

    // Link to existing contacts
    for (const participantEmail of participants) {
      const existingContacts = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.organizationId, orgId),
            ilike(schema.contacts.email, participantEmail),
          ),
        )
        .limit(1);

      if (existingContacts.length > 0) {
        const role =
          participantEmail === msg.from.email.toLowerCase()
            ? "from"
            : msg.to?.some(
                  (t) => t.email.toLowerCase() === participantEmail,
                )
              ? "to"
              : "cc";

        await db
          .insert(schema.emailContactLinks)
          .values({
            organizationId: orgId,
            syncedEmailId: emailId,
            contactId: existingContacts[0].id,
            role,
          })
          .onConflictDoNothing();
      }
    }

    // Score unknown participants for suggestions
    const allParticipantEmails = [
      { email: msg.from.email, name: msg.from.name ?? null },
      ...(msg.to ?? []).map((t) => ({
        email: t.email,
        name: t.name ?? null,
      })),
    ];

    for (const participant of allParticipantEmails) {
      const pEmail = participant.email.toLowerCase();
      if (shouldAutoExclude(pEmail)) continue;

      // Check if already a contact
      const isContact = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.organizationId, orgId),
            ilike(schema.contacts.email, pEmail),
          ),
        )
        .limit(1);

      if (isContact.length > 0) continue;

      // Get all emails involving this participant for scoring
      const participantEmails = await db
        .select({
          fromEmail: schema.syncedEmails.fromEmail,
          fromName: schema.syncedEmails.fromName,
          toAddresses: schema.syncedEmails.toAddresses,
          gmailThreadId: schema.syncedEmails.gmailThreadId,
          date: schema.syncedEmails.date,
        })
        .from(schema.syncedEmails)
        .where(
          and(
            eq(schema.syncedEmails.organizationId, orgId),
            sql`(${schema.syncedEmails.fromEmail} ILIKE ${pEmail} OR ${schema.syncedEmails.toAddresses}::text ILIKE ${"%" + pEmail + "%"})`,
          ),
        )
        .limit(50);

      if (participantEmails.length > 0) {
        await scoreParticipant(
          db,
          orgId,
          pEmail,
          participant.name,
          participantEmails.map((e) => ({
            fromEmail: e.fromEmail,
            fromName: e.fromName,
            toAddresses: e.toAddresses as { email: string; name?: string }[],
            gmailThreadId: e.gmailThreadId,
            date: e.date,
          })),
        );
      }
    }
  }

  return inserted;
}

async function resolveAiConfigForOrg(
  db: Db,
  env: Env,
  orgId: string,
): Promise<AiKeyConfig | null> {
  const [orgConfig] = await db
    .select()
    .from(schema.orgAiConfig)
    .where(eq(schema.orgAiConfig.organizationId, orgId))
    .limit(1);

  if (orgConfig?.apiKeyEnc) {
    const decrypted = decryptApiKey(orgConfig.apiKeyEnc);
    if (decrypted) {
      return {
        keyType: orgConfig.keyType as "basicsos" | "byok",
        apiKey: decrypted,
        byokProvider: orgConfig.byokProvider,
      };
    }
  }

  if (env.SERVER_BASICS_API_KEY) {
    return { keyType: "basicsos", apiKey: env.SERVER_BASICS_API_KEY };
  }

  if (env.SERVER_BYOK_PROVIDER && env.SERVER_BYOK_API_KEY) {
    return {
      keyType: "byok",
      apiKey: env.SERVER_BYOK_API_KEY,
      byokProvider: env.SERVER_BYOK_PROVIDER,
    };
  }

  return null;
}
