import { eq, and, sql } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { logger } from "@/lib/logger.js";
import { buildGatewayHeaders, type AiKeyConfig } from "@/lib/org-ai-config.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";
import { shouldAutoExclude } from "./contact-scorer.js";

const log = logger.child({ component: "deal-scorer" });

/* ------------------------------------------------------------------ */
/*  Cheap pre-filter (no AI)                                          */
/* ------------------------------------------------------------------ */

interface DealCandidateEmail {
  subject: string | null;
  fromEmail: string;
  fromName: string | null;
  ccAddresses: { email: string; name?: string }[];
  bodyText: string | null;
}

const DEAL_KEYWORDS = [
  "intro",
  "introduction",
  "meet",
  "founded",
  "raising",
  "round",
  "invest",
  "pitch",
  "deck",
  "opportunity",
  "partnership",
  "series",
  "seed",
  "funding",
  "venture",
  "startup",
  "co-founder",
  "cofounder",
];

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "gmx.com",
  "gmx.de",
  "fastmail.com",
]);

export function isDealCandidate(email: DealCandidateEmail): boolean {
  if (shouldAutoExclude(email.fromEmail)) return false;

  const subjectLower = (email.subject ?? "").toLowerCase();
  const hasKeyword = DEAL_KEYWORDS.some((kw) => subjectLower.includes(kw));
  const hasManyCC = (email.ccAddresses?.length ?? 0) >= 2;

  return hasKeyword || hasManyCC;
}

/* ------------------------------------------------------------------ */
/*  AI config resolution                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Types for the AI response                                         */
/* ------------------------------------------------------------------ */

interface AiDealResult {
  threadIndex: number;
  isDeal: boolean;
  confidence: number;
  dealName?: string | null;
  founderName?: string | null;
  founderEmail?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  companyCategory?: string | null;
  description?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Main AI analysis function                                         */
/* ------------------------------------------------------------------ */

interface ThreadGroup {
  gmailThreadId: string;
  emails: (typeof schema.syncedEmails.$inferSelect)[];
}

export async function analyzeDealCandidates(
  db: Db,
  env: Env,
  orgId: string,
): Promise<void> {
  log.info({ orgId }, "Starting deal candidate analysis");

  // 1. Fetch recent synced emails for this org
  const recentEmails = await db
    .select()
    .from(schema.syncedEmails)
    .where(eq(schema.syncedEmails.organizationId, orgId))
    .orderBy(sql`${schema.syncedEmails.date} DESC`)
    .limit(200);

  if (recentEmails.length === 0) {
    log.info({ orgId }, "No synced emails found, skipping deal analysis");
    return;
  }

  // 2. Group by gmailThreadId
  const threadMap = new Map<string, (typeof recentEmails)[number][]>();
  for (const email of recentEmails) {
    const threadId = email.gmailThreadId ?? email.gmailMessageId;
    const existing = threadMap.get(threadId);
    if (existing) {
      existing.push(email);
    } else {
      threadMap.set(threadId, [email]);
    }
  }

  // 3. Filter out threads that already have a suggested_deals row (any status)
  const allThreadIds = Array.from(threadMap.keys());

  const existingDealThreads = await db
    .select({ gmailThreadId: schema.suggestedDeals.gmailThreadId })
    .from(schema.suggestedDeals)
    .where(
      and(
        eq(schema.suggestedDeals.organizationId, orgId),
        sql`${schema.suggestedDeals.gmailThreadId} = ANY(${allThreadIds})`,
      ),
    );

  const existingThreadIdSet = new Set(
    existingDealThreads.map((r) => r.gmailThreadId).filter(Boolean),
  );

  const newThreads: ThreadGroup[] = [];
  for (const [threadId, emails] of threadMap) {
    if (existingThreadIdSet.has(threadId)) continue;
    newThreads.push({ gmailThreadId: threadId, emails });
  }

  // 4. Run isDealCandidate on each thread — keep threads with at least 1 candidate
  const candidateThreads = newThreads.filter((thread) =>
    thread.emails.some((email) =>
      isDealCandidate({
        subject: email.subject,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        ccAddresses: email.ccAddresses ?? [],
        bodyText: email.bodyText,
      }),
    ),
  );

  if (candidateThreads.length === 0) {
    log.info({ orgId }, "No deal candidate threads found");
    return;
  }

  log.info(
    { orgId, candidateCount: candidateThreads.length },
    "Found deal candidate threads",
  );

  // 5. Load email sync settings for deal criteria (optional custom prompt)
  let dealCriteriaText: string | null = null;
  const [syncState] = await db
    .select({ settings: schema.emailSyncState.settings })
    .from(schema.emailSyncState)
    .where(eq(schema.emailSyncState.organizationId, orgId))
    .limit(1);
  if (syncState?.settings && typeof syncState.settings === "object" && "dealCriteriaText" in syncState.settings) {
    const text = (syncState.settings as { dealCriteriaText?: string | null }).dealCriteriaText;
    dealCriteriaText = text && String(text).trim() ? String(text).trim() : null;
  }

  // 6. Resolve AI config
  const aiConfig = await resolveAiConfigForOrg(db, env, orgId);
  if (!aiConfig) {
    log.warn({ orgId }, "No AI config available, skipping deal analysis");
    return;
  }

  // 7. Batch up to 5 threads per AI call
  const BATCH_SIZE = 5;
  for (let i = 0; i < candidateThreads.length; i += BATCH_SIZE) {
    const batch = candidateThreads.slice(i, i + BATCH_SIZE);
    try {
      await analyzeBatch(db, env, orgId, aiConfig, batch, dealCriteriaText);
    } catch (err) {
      log.error({ err, orgId, batchIndex: i }, "Failed to analyze deal batch");
    }
  }

  log.info({ orgId }, "Deal candidate analysis complete");
}

/* ------------------------------------------------------------------ */
/*  Batch AI analysis                                                 */
/* ------------------------------------------------------------------ */

async function analyzeBatch(
  db: Db,
  env: Env,
  orgId: string,
  aiConfig: AiKeyConfig,
  threads: ThreadGroup[],
  dealCriteriaText: string | null,
): Promise<void> {
  // Build the user message with thread summaries
  const threadSummaries = threads.map((thread, idx) => {
    const firstEmail = thread.emails[0];
    const bodyPreview = (firstEmail?.bodyText ?? "").slice(0, 2000);
    return `Thread ${idx}:\nSubject: ${firstEmail?.subject ?? "(no subject)"}\nFrom: ${firstEmail?.fromName ?? ""} <${firstEmail?.fromEmail ?? ""}>\nEmails in thread: ${thread.emails.length}\nBody:\n${bodyPreview}`;
  });

  const userMessage = threadSummaries.join("\n\n---\n\n");

  const systemPrompt = dealCriteriaText
    ? `Consider the following as deal opportunities for this organization: ${dealCriteriaText}\n\nFor each thread, determine if it contains such a deal and extract information. Return ONLY a valid JSON array. Return [] if no deals found.`
    : "You analyze email threads to identify potential business deal opportunities (introductions to founders, investment discussions, partnership proposals, sales leads). For each thread, determine if it contains a deal opportunity and extract information. Return ONLY a valid JSON array. Return [] if no deals found.";

  const responseFormat = `Return format: [{ "threadIndex": number, "isDeal": boolean, "confidence": number (0-1), "dealName": string|null, "founderName": string|null, "founderEmail": string|null, "companyName": string|null, "companyDomain": string|null, "companyCategory": string|null, "description": string|null }]`;

  const headers = buildGatewayHeaders(aiConfig);

  const response = await fetch(
    `${env.BASICSOS_API_URL}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "basics-small",
        temperature: 0,
        max_tokens: 1000,
        messages: [
          { role: "system", content: `${systemPrompt}\n\n${responseFormat}` },
          { role: "user", content: userMessage },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    log.error(
      { orgId, status: response.status, body: errBody },
      "AI deal analysis request failed",
    );
    return;
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "[]";

  let results: AiDealResult[];
  try {
    results = JSON.parse(content);
    if (!Array.isArray(results)) {
      log.warn({ orgId, content }, "AI returned non-array for deal analysis");
      return;
    }
  } catch {
    log.warn({ orgId, content }, "Failed to parse AI deal analysis response");
    return;
  }

  // Process each result
  for (const result of results) {
    if (!result.isDeal || result.threadIndex < 0 || result.threadIndex >= threads.length) {
      continue;
    }

    const thread = threads[result.threadIndex];
    const score = computeDealScore(result, thread);

    const firstEmail = thread.emails[0];
    const senderDomains = new Set(
      thread.emails.map((e) => e.fromEmail.split("@")[1]?.toLowerCase()),
    );
    const isIntroEmail = thread.emails.some(
      (e) => (e.ccAddresses?.length ?? 0) >= 2,
    );
    const isBidirectional = senderDomains.size >= 2;

    const signals = {
      emailCount: thread.emails.length,
      threadCount: 1,
      isBidirectional,
      isIntroEmail,
      hasFounderSignals: !!result.founderName,
      confidence: result.confidence ?? 0,
    };

    try {
      await db
        .insert(schema.suggestedDeals)
        .values({
          organizationId: orgId,
          gmailThreadId: thread.gmailThreadId,
          sourceEmailId: firstEmail?.id ?? null,
          dealName: result.dealName ?? null,
          founderName: result.founderName ?? null,
          founderEmail: result.founderEmail ?? null,
          companyName: result.companyName ?? null,
          companyDomain: result.companyDomain ?? null,
          companyCategory: result.companyCategory ?? null,
          description: result.description ?? null,
          score,
          signals,
          status: "pending",
        })
        .onConflictDoUpdate({
          target: [
            schema.suggestedDeals.organizationId,
            schema.suggestedDeals.gmailThreadId,
          ],
          set: {
            score: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.score ELSE ${schema.suggestedDeals.score} END`,
            signals: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.signals ELSE ${schema.suggestedDeals.signals} END`,
            dealName: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.deal_name ELSE ${schema.suggestedDeals.dealName} END`,
            founderName: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.founder_name ELSE ${schema.suggestedDeals.founderName} END`,
            founderEmail: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.founder_email ELSE ${schema.suggestedDeals.founderEmail} END`,
            companyName: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.company_name ELSE ${schema.suggestedDeals.companyName} END`,
            companyDomain: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.company_domain ELSE ${schema.suggestedDeals.companyDomain} END`,
            companyCategory: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.company_category ELSE ${schema.suggestedDeals.companyCategory} END`,
            description: sql`CASE WHEN ${schema.suggestedDeals.status} = 'pending' THEN EXCLUDED.description ELSE ${schema.suggestedDeals.description} END`,
          },
        });
    } catch (err) {
      log.error(
        { err, orgId, threadId: thread.gmailThreadId },
        "Failed to upsert suggested deal",
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Score computation (deterministic, not AI)                         */
/* ------------------------------------------------------------------ */

function computeDealScore(result: AiDealResult, thread: ThreadGroup): number {
  let score = 0;

  // AI confidence
  if (result.confidence >= 0.8) score += 30;
  else if (result.confidence >= 0.6) score += 20;

  // Intro email (any email in thread has >= 2 CC addresses)
  const isIntroEmail = thread.emails.some(
    (e) => (e.ccAddresses?.length ?? 0) >= 2,
  );
  if (isIntroEmail) score += 20;

  // Bidirectional (multiple senders in thread)
  const senderEmails = new Set(
    thread.emails.map((e) => e.fromEmail.toLowerCase()),
  );
  if (senderEmails.size >= 2) score += 15;

  // Business domain (first email sender)
  const firstEmail = thread.emails[0];
  if (firstEmail) {
    const domain = firstEmail.fromEmail.split("@")[1]?.toLowerCase() ?? "";
    if (domain && !PERSONAL_DOMAINS.has(domain)) score += 10;
  }

  // Full founder name extracted
  if (result.founderName && result.founderName.trim().includes(" ")) {
    score += 10;
  }

  // Company domain extracted
  if (result.companyDomain) score += 5;

  // Recency (first email within 30 days)
  if (firstEmail) {
    const daysSince =
      (Date.now() - new Date(firstEmail.date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 30) score += 5;
  }

  return score;
}

/* ------------------------------------------------------------------ */
/*  External trigger alias                                            */
/* ------------------------------------------------------------------ */

export const enqueueDealAnalysis = analyzeDealCandidates;
