import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import type { Env } from "@/env.js";
import * as schema from "@/db/schema/index.js";
import { logger } from "@/lib/logger.js";
import { decryptApiKey } from "@/lib/api-key-crypto.js";
import { buildGatewayHeaders, type AiKeyConfig } from "@/lib/org-ai-config.js";

const log = logger.child({ component: "ai-enrichment" });

interface EnrichmentResult {
  title: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  companyName: string | null;
}

/**
 * Enrich a contact by analyzing their email signatures.
 * Runs ONLY on accepted contacts.
 */
export async function enrichContact(
  db: Db,
  env: Env,
  orgId: string,
  contactId: number,
): Promise<void> {
  try {
    // Get the contact
    const [contact] = await db
      .select()
      .from(schema.contacts)
      .where(
        and(
          eq(schema.contacts.id, contactId),
          eq(schema.contacts.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!contact?.email) return;

    // Get their recent emails where they're the sender
    const recentEmails = await db
      .select({
        bodyText: schema.syncedEmails.bodyText,
        fromName: schema.syncedEmails.fromName,
      })
      .from(schema.syncedEmails)
      .where(
        and(
          eq(schema.syncedEmails.organizationId, orgId),
          eq(schema.syncedEmails.fromEmail, contact.email.toLowerCase()),
        ),
      )
      .orderBy(desc(schema.syncedEmails.date))
      .limit(3);

    if (recentEmails.length === 0) return;

    // Extract last 15 lines from each email (signature zone)
    const signatureTexts = recentEmails
      .map((e) => {
        if (!e.bodyText) return null;
        const lines = e.bodyText.split("\n");
        return lines.slice(-15).join("\n");
      })
      .filter(Boolean);

    if (signatureTexts.length === 0) return;

    // Get AI config
    const aiConfig = await resolveAiConfigForOrg(db, env, orgId);
    if (!aiConfig) {
      log.warn({ orgId }, "No AI config for enrichment");
      return;
    }

    const headers = buildGatewayHeaders(aiConfig);
    const prompt = `Extract contact information from these email signatures. Return ONLY valid JSON with these fields (use null if not found):
{ "title": "job title", "phone": "phone number", "linkedinUrl": "linkedin URL", "companyName": "company name" }

Email signatures:
${signatureTexts.join("\n---\n")}`;

    const res = await fetch(`${env.BASICSOS_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You extract structured contact info from email signatures. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      log.warn({ orgId, contactId, status: res.status }, "AI enrichment API failed");
      return;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return;

    // Parse JSON (handle markdown fences)
    let cleaned = raw;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let result: EnrichmentResult;
    try {
      result = JSON.parse(cleaned);
    } catch {
      log.warn({ orgId, contactId, raw }, "Failed to parse enrichment JSON");
      return;
    }

    // Apply enrichment to contact
    const updates: Record<string, unknown> = {};
    const customFields = { ...(contact.customFields ?? {}) };

    if (result.linkedinUrl && !contact.linkedinUrl) {
      updates.linkedinUrl = result.linkedinUrl;
    }
    if (result.title) {
      customFields.title = result.title;
    }
    if (result.phone) {
      customFields.phone = result.phone;
    }
    customFields._enrichedAt = new Date().toISOString();

    updates.customFields = customFields;

    await db
      .update(schema.contacts)
      .set(updates)
      .where(eq(schema.contacts.id, contactId));

    // If contact has no company and we found a company name, try to link
    if (result.companyName && !contact.companyId) {
      const [existingCompany] = await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(
          and(
            eq(schema.companies.organizationId, orgId),
            eq(schema.companies.name, result.companyName),
          ),
        )
        .limit(1);

      if (existingCompany) {
        await db
          .update(schema.contacts)
          .set({ companyId: existingCompany.id })
          .where(eq(schema.contacts.id, contactId));
      }
    }

    log.info({ contactId, orgId }, "Contact enriched successfully");
  } catch (err) {
    log.error({ err, contactId, orgId }, "Contact enrichment failed");
  }
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
