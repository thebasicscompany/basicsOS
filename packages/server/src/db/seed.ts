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
  { name: "Acme Corp", sector: "information-technology", size: 250, website: "https://acme.example.com", phoneNumber: "+1-555-0100", address: "123 Innovation Way", city: "San Francisco", stateAbbr: "CA", country: "USA", zipcode: "94102", description: "Leading provider of innovative solutions.", revenue: "$50M", linkedinUrl: "https://linkedin.com/company/acme" },
  { name: "Globex Industries", sector: "industrials", size: 500, website: "https://globex.com", phoneNumber: "+1-555-0101", address: "456 Industrial Blvd", city: "Chicago", stateAbbr: "IL", country: "USA", zipcode: "60601", description: "Global industrial manufacturing conglomerate.", revenue: "$200M", linkedinUrl: "https://linkedin.com/company/globex" },
  { name: "Initech", sector: "financials", size: 50, website: "https://initech.com", phoneNumber: "+1-555-0102", address: "789 Office Park", city: "Austin", stateAbbr: "TX", country: "USA", zipcode: "78701", description: "Software and consulting for enterprise.", revenue: "$10M", linkedinUrl: "https://linkedin.com/company/initech" },
  { name: "Umbrella Corp", sector: "health-care", size: 500, website: "https://umbrellacorp.com", phoneNumber: "+1-555-0103", address: "1 Research Plaza", city: "Raccoon City", stateAbbr: "CA", country: "USA", zipcode: "90210", description: "Pharmaceutical and biotechnology research.", revenue: "$500M", linkedinUrl: "https://linkedin.com/company/umbrella" },
  { name: "Stark Industries", sector: "energy", size: 250, website: "https://starkindustries.com", phoneNumber: "+1-555-0104", address: "100 Tech Campus", city: "New York", stateAbbr: "NY", country: "USA", zipcode: "10001", description: "Advanced technology and defense.", revenue: "$1B", linkedinUrl: "https://linkedin.com/company/stark" },
  { name: "Wayne Enterprises", sector: "consumer-discretionary", size: 500, website: "https://wayne-ent.com", phoneNumber: "+1-555-0105", address: "200 Gotham Tower", city: "Gotham", stateAbbr: "NJ", country: "USA", zipcode: "07001", description: "Diversified holding company.", revenue: "$2B", linkedinUrl: "https://linkedin.com/company/wayne" },
  { name: "Cyberdyne Systems", sector: "information-technology", size: 50, website: "https://cyberdyne.ai", phoneNumber: "+1-555-0106", address: "300 Silicon Valley Dr", city: "San Jose", stateAbbr: "CA", country: "USA", zipcode: "95101", description: "AI and robotics research.", revenue: "$25M", linkedinUrl: "https://linkedin.com/company/cyberdyne" },
  { name: "Wonka Industries", sector: "consumer-staples", size: 250, website: "https://wonka.com", phoneNumber: "+1-555-0107", address: "Factory Lane", city: "London", stateAbbr: null, country: "UK", zipcode: "SW1A 1AA", description: "Confectionery and chocolate manufacturer.", revenue: "$100M", linkedinUrl: "https://linkedin.com/company/wonka" },
];

const DEMO_CONTACTS = [
  { firstName: "Jane", lastName: "Smith", title: "VP Sales", gender: "female", status: "lead", background: "15 years in enterprise sales.", linkedinUrl: "https://linkedin.com/in/janesmith" },
  { firstName: "John", lastName: "Doe", title: "CTO", gender: "male", status: "qualified", background: "Former startup founder. Tech leader.", linkedinUrl: "https://linkedin.com/in/johndoe" },
  { firstName: "Alice", lastName: "Johnson", title: "Marketing Director", gender: "female", status: "lead", background: "Brand strategy and growth marketing.", linkedinUrl: "https://linkedin.com/in/alicejohnson" },
  { firstName: "Bob", lastName: "Williams", title: "Procurement Manager", gender: "male", status: "qualified", background: "Supply chain and vendor management.", linkedinUrl: "https://linkedin.com/in/bobwilliams" },
  { firstName: "Carol", lastName: "Brown", title: "Head of Engineering", gender: "female", status: "customer", background: "Built teams at 3 unicorns.", linkedinUrl: "https://linkedin.com/in/carolbrown" },
  { firstName: "David", lastName: "Davis", title: "CFO", gender: "male", status: "qualified", background: "IPO experience. M&A expertise.", linkedinUrl: "https://linkedin.com/in/daviddavis" },
  { firstName: "Eve", lastName: "Miller", title: "Product Manager", gender: "female", status: "lead", background: "B2B SaaS product strategy.", linkedinUrl: "https://linkedin.com/in/evemiller" },
  { firstName: "Frank", lastName: "Wilson", title: "Account Executive", gender: "male", status: "customer", background: "Top performer 3 years running.", linkedinUrl: "https://linkedin.com/in/frankwilson" },
];

async function fillEmptyColumns(
  db: ReturnType<typeof createDb>,
  salesId: number,
) {
  const existingCompanies = await db.select().from(schema.companies).limit(1);
  if (existingCompanies.length === 0) return;

  console.log("[seed] Filling empty columns in existing data...");

  const companies = await db.select().from(schema.companies);
  const companyUpdates = [
    { website: "https://acme.example.com", phoneNumber: "+1-555-0100", address: "123 Innovation Way", city: "San Francisco", stateAbbr: "CA", country: "USA", zipcode: "94102", description: "Leading provider of innovative solutions.", revenue: "$50M", linkedinUrl: "https://linkedin.com/company/acme" },
    { website: "https://globex.com", phoneNumber: "+1-555-0101", address: "456 Industrial Blvd", city: "Chicago", stateAbbr: "IL", country: "USA", zipcode: "60601", description: "Global industrial manufacturing conglomerate.", revenue: "$200M", linkedinUrl: "https://linkedin.com/company/globex" },
    { website: "https://initech.com", phoneNumber: "+1-555-0102", address: "789 Office Park", city: "Austin", stateAbbr: "TX", country: "USA", zipcode: "78701", description: "Software and consulting for enterprise.", revenue: "$10M", linkedinUrl: "https://linkedin.com/company/initech" },
    { website: "https://umbrellacorp.com", phoneNumber: "+1-555-0103", address: "1 Research Plaza", city: "Raccoon City", stateAbbr: "CA", country: "USA", zipcode: "90210", description: "Pharmaceutical and biotechnology research.", revenue: "$500M", linkedinUrl: "https://linkedin.com/company/umbrella" },
    { website: "https://starkindustries.com", phoneNumber: "+1-555-0104", address: "100 Tech Campus", city: "New York", stateAbbr: "NY", country: "USA", zipcode: "10001", description: "Advanced technology and defense.", revenue: "$1B", linkedinUrl: "https://linkedin.com/company/stark" },
    { website: "https://wayne-ent.com", phoneNumber: "+1-555-0105", address: "200 Gotham Tower", city: "Gotham", stateAbbr: "NJ", country: "USA", zipcode: "07001", description: "Diversified holding company.", revenue: "$2B", linkedinUrl: "https://linkedin.com/company/wayne" },
    { website: "https://cyberdyne.ai", phoneNumber: "+1-555-0106", address: "300 Silicon Valley Dr", city: "San Jose", stateAbbr: "CA", country: "USA", zipcode: "95101", description: "AI and robotics research.", revenue: "$25M", linkedinUrl: "https://linkedin.com/company/cyberdyne" },
    { website: "https://wonka.com", phoneNumber: "+1-555-0107", address: "Factory Lane", city: "London", stateAbbr: null, country: "UK", zipcode: "SW1A 1AA", description: "Confectionery and chocolate manufacturer.", revenue: "$100M", linkedinUrl: "https://linkedin.com/company/wonka" },
  ];
  for (let i = 0; i < companies.length && i < companyUpdates.length; i++) {
    await db
      .update(schema.companies)
      .set(companyUpdates[i] as Record<string, unknown>)
      .where(eq(schema.companies.id, companies[i].id));
  }

  const contacts = await db.select().from(schema.contacts);
  const contactUpdates = [
    { gender: "female", status: "lead", background: "15 years in enterprise sales.", linkedinUrl: "https://linkedin.com/in/janesmith", phoneJsonb: [{ number: "+1-555-1000", type: "Work" }], hasNewsletter: true },
    { gender: "male", status: "qualified", background: "Former startup founder. Tech leader.", linkedinUrl: "https://linkedin.com/in/johndoe", phoneJsonb: [{ number: "+1-555-1001", type: "Work" }], hasNewsletter: false },
    { gender: "female", status: "lead", background: "Brand strategy and growth marketing.", linkedinUrl: "https://linkedin.com/in/alicejohnson", phoneJsonb: [{ number: "+1-555-1002", type: "Work" }], hasNewsletter: true },
    { gender: "male", status: "qualified", background: "Supply chain and vendor management.", linkedinUrl: "https://linkedin.com/in/bobwilliams", phoneJsonb: [{ number: "+1-555-1003", type: "Work" }], hasNewsletter: false },
    { gender: "female", status: "customer", background: "Built teams at 3 unicorns.", linkedinUrl: "https://linkedin.com/in/carolbrown", phoneJsonb: [{ number: "+1-555-1004", type: "Work" }], hasNewsletter: true },
    { gender: "male", status: "qualified", background: "IPO experience. M&A expertise.", linkedinUrl: "https://linkedin.com/in/daviddavis", phoneJsonb: [{ number: "+1-555-1005", type: "Work" }], hasNewsletter: false },
    { gender: "female", status: "lead", background: "B2B SaaS product strategy.", linkedinUrl: "https://linkedin.com/in/evemiller", phoneJsonb: [{ number: "+1-555-1006", type: "Work" }], hasNewsletter: true },
    { gender: "male", status: "customer", background: "Top performer 3 years running.", linkedinUrl: "https://linkedin.com/in/frankwilson", phoneJsonb: [{ number: "+1-555-1007", type: "Work" }], hasNewsletter: false },
  ];
  for (let i = 0; i < contacts.length && i < contactUpdates.length; i++) {
    await db
      .update(schema.contacts)
      .set(contactUpdates[i] as Record<string, unknown>)
      .where(eq(schema.contacts.id, contacts[i].id));
  }

  const allDeals = await db.select().from(schema.deals);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in60 = new Date(now.getTime() + 60 * 86400000);
  const in90 = new Date(now.getTime() + 90 * 86400000);
  const dealUpdates = [
    { description: "Full redesign of corporate website with new CMS.", expectedClosingDate: in30 },
    { description: "Comprehensive UX audit and recommendations.", expectedClosingDate: in60 },
    { description: "Homepage and landing page copy refresh.", expectedClosingDate: in90 },
    { description: "Annual enterprise platform license.", expectedClosingDate: now },
  ];
  for (let i = 0; i < allDeals.length && i < dealUpdates.length; i++) {
    await db
      .update(schema.deals)
      .set(dealUpdates[i])
      .where(eq(schema.deals.id, allDeals[i].id));
  }

  console.log("[seed] Done filling empty columns!");
}

async function seed(db: ReturnType<typeof createDb>, salesId: number) {
  const existingCompanies = await db.select().from(schema.companies).limit(1);
  if (existingCompanies.length > 0) {
    console.log("[seed] CRM data already exists, filling empty columns...");
    await fillEmptyColumns(db, salesId);
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
        website: c.website,
        phoneNumber: c.phoneNumber,
        address: c.address,
        city: c.city,
        stateAbbr: c.stateAbbr ?? undefined,
        country: c.country,
        zipcode: c.zipcode,
        description: c.description,
        revenue: c.revenue,
        linkedinUrl: c.linkedinUrl,
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
        gender: c.gender,
        status: c.status,
        background: c.background,
        linkedinUrl: c.linkedinUrl,
        companyId: companies[i % companies.length].id,
        salesId,
        emailJsonb: [{ email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@example.com`, type: "Work" }],
        phoneJsonb: [{ number: `+1-555-${String(1000 + i).padStart(4, "0")}`, type: "Work" }],
        hasNewsletter: i % 2 === 0,
      }))
    )
    .returning();

  console.log("[seed] Inserting deals...");
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86400000);
  const in60Days = new Date(now.getTime() + 60 * 86400000);
  const in90Days = new Date(now.getTime() + 90 * 86400000);
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
        description: "Full redesign of corporate website with new CMS.",
        expectedClosingDate: in30Days,
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
        description: "Comprehensive UX audit and recommendations.",
        expectedClosingDate: in60Days,
        salesId,
        index: 0,
      },
      {
        name: "Brand copywriting",
        companyId: companies[2].id,
        contactIds: [contacts[3].id],
        category: "copywriting",
        stage: "in-negotiation",
        amount: 8000,
        description: "Homepage and landing page copy refresh.",
        expectedClosingDate: in90Days,
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
        description: "Annual enterprise platform license.",
        expectedClosingDate: now,
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
      { value: "in-negotiation", label: "In Negotiation" },
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
