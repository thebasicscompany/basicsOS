/**
 * Seed script: creates admin@example.com (password: admin123) and demo CRM data.
 * Run: pnpm db:seed
 * Works with or without server running - uses signup API if available, else direct DB insert.
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import * as schema from "./schema/index.js";

const DEMO_USER = {
  email: "admin@example.com",
  password: "admin123",
  firstName: "Admin",
  lastName: "User",
};

const API_URL = process.env.SEED_API_URL ?? "http://localhost:3001";

async function ensureAdminUser(db: ReturnType<typeof createDb>): Promise<number> {
  const salesRows = await db.select().from(schema.sales).limit(1);

  if (salesRows.length > 0) {
    console.log("[seed] Using existing org/sales");
    return salesRows[0].id;
  }

  // Try signup API first (requires server running)
  const res = await fetch(`${API_URL}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      first_name: DEMO_USER.firstName,
      last_name: DEMO_USER.lastName,
    }),
  });

  if (res.ok) {
    const [sale] = await db
      .select()
      .from(schema.sales)
      .orderBy(schema.sales.id)
      .limit(1);
    if (!sale) throw new Error("Sales row not found after signup");
    return sale.id;
  }

  // Fallback: direct DB insert (no server needed)
  const now = new Date();
  const existingUsers = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, DEMO_USER.email))
    .limit(1);

  let userId: string;
  if (existingUsers.length > 0) {
    console.log("[seed] Admin user already exists, ensuring org/sales...");
    userId = existingUsers[0].id;
    const existingSales = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.userId, userId))
      .limit(1);
    if (existingSales.length > 0) return existingSales[0].id;

    const existingAccounts = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, userId))
      .limit(1);
    if (existingAccounts.length === 0) {
      const passwordHash = await hashPassword(DEMO_USER.password);
      await db.insert(schema.account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      });
    }

    let orgId: number;
    const existingOrgs = await db
      .select()
      .from(schema.organizations)
      .limit(1);
    if (existingOrgs.length > 0) {
      orgId = existingOrgs[0].id;
    } else {
      const [org] = await db
        .insert(schema.organizations)
        .values({ name: `${DEMO_USER.firstName}'s Organization` })
        .returning();
      if (!org) throw new Error("Failed to create organization");
      orgId = org.id;
    }

    const [sale] = await db
      .insert(schema.sales)
      .values({
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        email: DEMO_USER.email,
        userId,
        organizationId: orgId,
        administrator: true,
      })
      .returning();
    if (!sale) throw new Error("Failed to create sales");
    return sale.id;
  }

  console.log("[seed] Creating user directly...");
  userId = randomUUID();
  const passwordHash = await hashPassword(DEMO_USER.password);

  await db.insert(schema.user).values({
    id: userId,
    name: `${DEMO_USER.firstName} ${DEMO_USER.lastName}`,
    email: DEMO_USER.email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  const [org] = await db
    .insert(schema.organizations)
    .values({ name: `${DEMO_USER.firstName}'s Organization` })
    .returning();
  if (!org) throw new Error("Failed to create organization");

  const [sale] = await db
    .insert(schema.sales)
    .values({
      firstName: DEMO_USER.firstName,
      lastName: DEMO_USER.lastName,
      email: DEMO_USER.email,
      userId,
      organizationId: org.id,
      administrator: true,
    })
    .returning();
  if (!sale) throw new Error("Failed to create sales");

  return sale.id;
}

const DEMO_COMPANIES = [
  { name: "Acme Corp", sector: "information-technology", size: 250 },
  { name: "Globex Industries", sector: "industrials", size: 500 },
  { name: "Initech", sector: "financials", size: 50 },
  { name: "Umbrella Corp", sector: "health-care", size: 500 },
  { name: "Stark Industries", sector: "energy", size: 250 },
  { name: "Wayne Enterprises", sector: "consumer-discretionary", size: 500 },
  { name: "Cyberdyne Systems", sector: "information-technology", size: 50 },
  { name: "Wonka Industries", sector: "consumer-staples", size: 250 },
];

const DEMO_CONTACTS = [
  { firstName: "Jane", lastName: "Smith", title: "VP Sales" },
  { firstName: "John", lastName: "Doe", title: "CTO" },
  { firstName: "Alice", lastName: "Johnson", title: "Marketing Director" },
  { firstName: "Bob", lastName: "Williams", title: "Procurement Manager" },
  { firstName: "Carol", lastName: "Brown", title: "Head of Engineering" },
  { firstName: "David", lastName: "Davis", title: "CFO" },
  { firstName: "Eve", lastName: "Miller", title: "Product Manager" },
  { firstName: "Frank", lastName: "Wilson", title: "Account Executive" },
];

async function seed(db: ReturnType<typeof createDb>, salesId: number) {
  const existingCompanies = await db.select().from(schema.companies).limit(1);
  if (existingCompanies.length > 0) {
    console.log("[seed] CRM data already exists, skipping");
    return;
  }

  console.log("[seed] Inserting companies...");
  const companies = await db
    .insert(schema.companies)
    .values(
      DEMO_COMPANIES.map((c) => ({
        name: c.name,
        sector: c.sector,
        size: c.size,
        salesId,
      }))
    )
    .returning();

  console.log("[seed] Inserting contacts...");
  const contacts = await db
    .insert(schema.contacts)
    .values(
      DEMO_CONTACTS.map((c, i) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        companyId: companies[i % companies.length].id,
        salesId,
        emailJsonb: [{ email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@example.com`, type: "Work" }],
      }))
    )
    .returning();

  console.log("[seed] Inserting deals...");
  const deals = await db
    .insert(schema.deals)
    .values([
      {
        name: "Website redesign",
        companyId: companies[0].id,
        contactIds: [contacts[0].id, contacts[1].id],
        category: "website-design",
        stage: "proposal-sent",
        amount: 50000,
        salesId,
        index: 0,
      },
      {
        name: "UI/UX audit",
        companyId: companies[1].id,
        contactIds: [contacts[2].id],
        category: "ui-design",
        stage: "opportunity",
        amount: 15000,
        salesId,
        index: 0,
      },
      {
        name: "Brand copywriting",
        companyId: companies[2].id,
        contactIds: [contacts[3].id],
        category: "copywriting",
        stage: "in-negociation",
        amount: 8000,
        salesId,
        index: 0,
      },
      {
        name: "Enterprise license",
        companyId: companies[3].id,
        contactIds: [contacts[4].id, contacts[5].id],
        category: "other",
        stage: "won",
        amount: 120000,
        salesId,
        index: 0,
      },
    ])
    .returning();

  console.log("[seed] Inserting tasks...");
  await db.insert(schema.tasks).values([
    { contactId: contacts[0].id, salesId, type: "call", text: "Follow up on proposal", dueDate: new Date(Date.now() + 86400000) },
    { contactId: contacts[2].id, salesId, type: "meeting", text: "Discovery call", dueDate: new Date(Date.now() + 172800000) },
  ]);

  console.log("[seed] Inserting notes...");
  await db.insert(schema.contactNotes).values([
    { contactId: contacts[0].id, salesId, text: "Met at conference. Interested in Q2." },
    { contactId: contacts[4].id, salesId, text: "Closed the deal. Great partnership." },
  ]);
  await db.insert(schema.dealNotes).values([
    { dealId: deals[0].id, salesId, text: "Sent proposal. Awaiting feedback." },
  ]);

  console.log("[seed] Inserting tags...");
  await db.insert(schema.tags).values([
    { name: "VIP", color: "#e88b7d" },
    { name: "Hot", color: "#e8cb7d" },
    { name: "Cold", color: "#7dbde8" },
  ]);

  console.log("[seed] Updating configuration...");
  const defaultConfig = {
    title: "Basics CRM",
    companySectors: [
      { value: "information-technology", label: "Information Technology" },
      { value: "health-care", label: "Health Care" },
      { value: "financials", label: "Financials" },
    ],
    dealStages: [
      { value: "opportunity", label: "Opportunity" },
      { value: "proposal-sent", label: "Proposal Sent" },
      { value: "in-negociation", label: "In Negotiation" },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
    ],
    dealCategories: [
      { value: "other", label: "Other" },
      { value: "copywriting", label: "Copywriting" },
      { value: "ui-design", label: "UI Design" },
      { value: "website-design", label: "Website design" },
    ],
  };
  await db
    .insert(schema.configuration)
    .values({ id: 1, config: defaultConfig })
    .onConflictDoUpdate({
      target: schema.configuration.id,
      set: { config: defaultConfig },
    });

  console.log("[seed] Done!");
  console.log(`[seed] Login: ${DEMO_USER.email} / ${DEMO_USER.password}`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5435/crm";
  const db = createDb(url);
  const salesId = await ensureAdminUser(db);
  await seed(db, salesId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
