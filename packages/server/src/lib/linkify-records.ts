/**
 * Post-process AI text to turn known CRM record names into markdown links.
 * Works regardless of whether the AI called tools — queries the DB directly.
 */

import { eq } from "drizzle-orm";
import type { Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

type RecordRef = { name: string; slug: string; id: number };

export async function linkifyRecordNames(
  db: Db,
  organizationId: string,
  text: string,
): Promise<string> {
  const [contacts, companies, deals] = await Promise.all([
    db
      .select({
        id: schema.contacts.id,
        firstName: schema.contacts.firstName,
        lastName: schema.contacts.lastName,
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.organizationId, organizationId))
      .limit(80),
    db
      .select({ id: schema.companies.id, name: schema.companies.name })
      .from(schema.companies)
      .where(eq(schema.companies.organizationId, organizationId))
      .limit(80),
    db
      .select({ id: schema.deals.id, name: schema.deals.name })
      .from(schema.deals)
      .where(
        eq(schema.deals.organizationId, organizationId),
      )
      .limit(80),
  ]);

  const refs: RecordRef[] = [];

  for (const c of contacts) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
    if (name.length >= 2) refs.push({ name, slug: "contacts", id: c.id });
  }
  for (const c of companies) {
    if (c.name.length >= 2) refs.push({ name: c.name, slug: "companies", id: c.id });
  }
  for (const d of deals) {
    if (d.name.length >= 2) refs.push({ name: d.name, slug: "deals", id: d.id });
  }

  if (refs.length === 0) return text;

  const unique = new Map<string, RecordRef>();
  for (const r of refs) {
    const key = r.name.toLowerCase();
    if (!unique.has(key)) unique.set(key, r);
  }

  const sorted = [...unique.values()].sort(
    (a, b) => b.name.length - a.name.length,
  );

  const byName = new Map<string, RecordRef>();
  for (const r of sorted) byName.set(r.name.toLowerCase(), r);

  const pattern = sorted
    .map((r) => r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`\\b(${pattern})\\b`, "gi");

  return text.replace(re, (match) => {
    const ref = byName.get(match.toLowerCase());
    if (!ref) return match;
    return `[${match}](/objects/${ref.slug}/${ref.id})`;
  });
}
