import { sql } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { logger } from "@/lib/logger.js";

const log = logger.child({ component: "contact-scorer" });

/** Email prefixes that are always automated / junk */
const AUTO_EXCLUDE_PREFIXES = new Set([
  "noreply",
  "no-reply",
  "no_reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "notifications",
  "notification",
  "alerts",
  "alert",
  "unsubscribe",
  "donotreply",
  "do-not-reply",
  "do_not_reply",
  "auto",
  "automated",
  "daemon",
]);

/** Name patterns that look automated */
const AUTOMATED_NAME_RE =
  /^(support|team|info|help|admin|billing|sales|newsletter|notifications?|alerts?|updates?|service|system|mail|feedback|marketing|press|contact|hello|hi|hey|ops|devops|engineering|hr|legal|finance|accounting|security|compliance|operations|customer\s?service|customer\s?success)$/i;

/** Personal email domains (score lower but don't exclude) */
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

interface ScorerEmail {
  fromEmail: string;
  fromName: string | null;
  toAddresses: { email: string; name?: string }[];
  gmailThreadId: string | null;
  date: Date;
}

export function shouldAutoExclude(email: string): boolean {
  const prefix = email.split("@")[0]?.toLowerCase();
  if (!prefix) return true;
  return AUTO_EXCLUDE_PREFIXES.has(prefix);
}

function getDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function classifyDomain(domain: string): "business" | "personal" | "unknown" {
  if (!domain) return "unknown";
  if (PERSONAL_DOMAINS.has(domain)) return "personal";
  return "business";
}

function classifyName(
  name: string | null,
): "full_name" | "partial" | "automated" | "none" {
  if (!name || name.trim().length === 0) return "none";
  const trimmed = name.trim();
  if (AUTOMATED_NAME_RE.test(trimmed)) return "automated";
  // Full name = has at least one space separating two words
  if (trimmed.includes(" ") && trimmed.split(/\s+/).length >= 2)
    return "full_name";
  return "partial";
}

function parseName(fullName: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName || !fullName.trim()) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function scoreParticipant(
  db: Db,
  orgId: string,
  email: string,
  name: string | null,
  emails: ScorerEmail[],
): Promise<void> {
  if (shouldAutoExclude(email)) return;

  const domain = getDomain(email);
  const domainType = classifyDomain(domain);
  const nameQuality = classifyName(name);

  // Automated names get rejected
  if (nameQuality === "automated") return;

  const emailCount = emails.length;
  const threadIds = new Set(emails.map((e) => e.gmailThreadId).filter(Boolean));
  const threadCount = threadIds.size;

  // Check bidirectionality: did the user send TO this person?
  const isBidirectional = emails.some((e) => {
    // If fromEmail is different from the scored email, the user sent this email,
    // so this person was a recipient
    return e.fromEmail.toLowerCase() !== email.toLowerCase();
  });

  // Latest interaction
  const latestDate = emails.reduce(
    (latest, e) => (e.date > latest ? e.date : latest),
    emails[0].date,
  );
  const daysSinceLatest =
    (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24);

  // Score calculation
  let score = 0;

  if (isBidirectional) score += 30;
  if (emailCount >= 3) score += 20;
  else if (emailCount >= 2) score += 10;
  if (domainType === "business") score += 15;
  if (nameQuality === "full_name") score += 10;
  else if (nameQuality === "partial") score += 5;
  if (daysSinceLatest <= 30) score += 5;
  if (threadCount >= 2) score += 5;

  // Penalties
  if (!isBidirectional && emailCount === 1) score -= 30;
  if (domainType === "personal" && nameQuality === "none") score -= 20;

  if (score < 0) return;

  const { firstName, lastName } = parseName(name);

  // Infer company name from domain (just capitalize domain without TLD)
  let companyName: string | null = null;
  if (domainType === "business" && domain) {
    const domainBase = domain.split(".")[0];
    if (domainBase && domainBase.length > 1) {
      companyName =
        domainBase.charAt(0).toUpperCase() + domainBase.slice(1);
    }
  }

  const signals = {
    isBidirectional,
    emailCount,
    threadCount,
    hasSignature: false, // Could be enhanced later
    domainType,
    latestInteraction: latestDate.toISOString(),
    hasBulkHeaders: false,
    senderNameQuality: nameQuality,
  };

  try {
    await db
      .insert(schema.suggestedContacts)
      .values({
        organizationId: orgId,
        email: email.toLowerCase(),
        firstName,
        lastName,
        domain: domainType === "personal" ? null : domain,
        companyName,
        score,
        signals,
        status: "pending",
        emailCount,
        lastEmailDate: latestDate,
      })
      .onConflictDoUpdate({
        target: [
          schema.suggestedContacts.organizationId,
          schema.suggestedContacts.email,
        ],
        set: {
          score: sql`CASE WHEN ${schema.suggestedContacts.status} IN ('accepted', 'dismissed') THEN ${schema.suggestedContacts.score} ELSE EXCLUDED.score END`,
          signals: sql`CASE WHEN ${schema.suggestedContacts.status} IN ('accepted', 'dismissed') THEN ${schema.suggestedContacts.signals} ELSE EXCLUDED.signals END`,
          emailCount: sql`EXCLUDED.email_count`,
          lastEmailDate: sql`EXCLUDED.last_email_date`,
          firstName: sql`COALESCE(EXCLUDED.first_name, ${schema.suggestedContacts.firstName})`,
          lastName: sql`COALESCE(EXCLUDED.last_name, ${schema.suggestedContacts.lastName})`,
          companyName: sql`COALESCE(EXCLUDED.company_name, ${schema.suggestedContacts.companyName})`,
          domain: sql`COALESCE(EXCLUDED.domain, ${schema.suggestedContacts.domain})`,
        },
      });
  } catch (err) {
    log.error({ err, email, orgId }, "Failed to upsert suggested contact");
  }
}
