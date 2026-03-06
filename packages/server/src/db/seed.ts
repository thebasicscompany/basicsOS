/**
 * Seed script: creates admin@example.com (password: admin123) and demo CRM data.
 * Run: pnpm db:seed
 * Works with or without server running - uses signup API if available, else direct DB insert.
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";
import { logger } from "@/lib/logger.js";

const log = logger.child({ component: "seed" });

const DEMO_USER = {
  email: "admin@example.com",
  password: "admin123",
  firstName: "Admin",
  lastName: "User",
};

const API_URL = process.env.SEED_API_URL ?? "http://localhost:3001";

async function ensureAdminUser(db: Db): Promise<number> {
  const crmUserRows = await db.select().from(schema.crmUsers).limit(1);

  if (crmUserRows.length > 0) {
    log.info("Using existing org/crm user");
    return crmUserRows[0].id;
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
    const [crmUser] = await db
      .select()
      .from(schema.crmUsers)
      .orderBy(schema.crmUsers.id)
      .limit(1);
    if (!crmUser) throw new Error("CRM user not found after signup");
    return crmUser.id;
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
    log.info("Admin user already exists, ensuring org/crm user...");
    userId = existingUsers[0].id;
    const existingCrmUsers = await db
      .select()
      .from(schema.crmUsers)
      .where(eq(schema.crmUsers.userId, userId))
      .limit(1);
    if (existingCrmUsers.length > 0) return existingCrmUsers[0].id;

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

    let orgId: string;
    const existingOrgs = await db.select().from(schema.organizations).limit(1);
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

    const [crmUser] = await db
      .insert(schema.crmUsers)
      .values({
        firstName: DEMO_USER.firstName,
        lastName: DEMO_USER.lastName,
        email: DEMO_USER.email,
        userId,
        organizationId: orgId,
        administrator: true,
      })
      .returning();
    if (!crmUser) throw new Error("Failed to create CRM user");
    return crmUser.id;
  }

  log.info("Creating user directly...");
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

  const [crmUser] = await db
    .insert(schema.crmUsers)
    .values({
      firstName: DEMO_USER.firstName,
      lastName: DEMO_USER.lastName,
      email: DEMO_USER.email,
      userId,
      organizationId: org.id,
      administrator: true,
    })
    .returning();
  if (!crmUser) throw new Error("Failed to create CRM user");

  return crmUser.id;
}

const DEMO_COMPANIES = [
  {
    name: "Acme Corp",
    category: "technology",
    domain: "acme.example.com",
    description: "Leading provider of innovative solutions.",
  },
  {
    name: "Globex Industries",
    category: "enterprise",
    domain: "globex.com",
    description: "Global industrial manufacturing conglomerate.",
  },
  {
    name: "Initech",
    category: "finance",
    domain: "initech.com",
    description: "Software and consulting for enterprise.",
  },
  {
    name: "Umbrella Corp",
    category: "healthcare",
    domain: "umbrellacorp.com",
    description: "Pharmaceutical and biotechnology research.",
  },
  {
    name: "Stark Industries",
    category: "technology",
    domain: "starkindustries.com",
    description: "Advanced technology and defense.",
  },
  {
    name: "Wayne Enterprises",
    category: "enterprise",
    domain: "wayne-ent.com",
    description: "Diversified holding company.",
  },
  {
    name: "Cyberdyne Systems",
    category: "saas",
    domain: "cyberdyne.ai",
    description: "AI and robotics research.",
  },
  {
    name: "Wonka Industries",
    category: "b2c",
    domain: "wonka.com",
    description: "Confectionery and chocolate manufacturer.",
  },
];

const DEMO_CONTACTS = [
  {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    linkedinUrl: "https://linkedin.com/in/janesmith",
  },
  {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    linkedinUrl: "https://linkedin.com/in/johndoe",
  },
  {
    firstName: "Alice",
    lastName: "Johnson",
    email: "alice.johnson@example.com",
    linkedinUrl: "https://linkedin.com/in/alicejohnson",
  },
  {
    firstName: "Bob",
    lastName: "Williams",
    email: "bob.williams@example.com",
    linkedinUrl: "https://linkedin.com/in/bobwilliams",
  },
  {
    firstName: "Carol",
    lastName: "Brown",
    email: "carol.brown@example.com",
    linkedinUrl: "https://linkedin.com/in/carolbrown",
  },
  {
    firstName: "David",
    lastName: "Davis",
    email: "david.davis@example.com",
    linkedinUrl: "https://linkedin.com/in/daviddavis",
  },
  {
    firstName: "Eve",
    lastName: "Miller",
    email: "eve.miller@example.com",
    linkedinUrl: "https://linkedin.com/in/evemiller",
  },
  {
    firstName: "Frank",
    lastName: "Wilson",
    email: "frank.wilson@example.com",
    linkedinUrl: "https://linkedin.com/in/frankwilson",
  },
];

async function fillEmptyColumns(db: Db) {
  const existingCompanies = await db.select().from(schema.companies).limit(1);
  if (existingCompanies.length === 0) return;

  log.info("Filling empty columns in existing data...");

  const companies = await db.select().from(schema.companies);
  const companyUpdates = DEMO_COMPANIES.map((c) => ({
    domain: c.domain,
    description: c.description,
    category: c.category,
  }));
  for (let i = 0; i < companies.length && i < companyUpdates.length; i++) {
    await db
      .update(schema.companies)
      .set(companyUpdates[i] as Record<string, unknown>)
      .where(eq(schema.companies.id, companies[i].id));
  }

  const contacts = await db.select().from(schema.contacts);
  const contactUpdates = DEMO_CONTACTS.map((c) => ({
    email: c.email,
    linkedinUrl: c.linkedinUrl,
  }));
  for (let i = 0; i < contacts.length && i < contactUpdates.length; i++) {
    await db
      .update(schema.contacts)
      .set(contactUpdates[i] as Record<string, unknown>)
      .where(eq(schema.contacts.id, contacts[i].id));
  }

  log.info("Done filling empty columns!");
}

async function seed(db: Db, crmUserId: number) {
  const existingCompanies = await db.select().from(schema.companies).limit(1);
  if (existingCompanies.length > 0) {
    log.info("CRM data already exists, filling empty columns...");
    await fillEmptyColumns(db);
    return;
  }

  log.info("Inserting companies...");
  const companies = await db
    .insert(schema.companies)
    .values(
      DEMO_COMPANIES.map((c) => ({
        name: c.name,
        category: c.category,
        domain: c.domain,
        description: c.description,
        crmUserId,
      })),
    )
    .returning();

  log.info("Inserting contacts...");
  const contacts = await db
    .insert(schema.contacts)
    .values(
      DEMO_CONTACTS.map((c, i) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        linkedinUrl: c.linkedinUrl,
        companyId: companies[i % companies.length].id,
        crmUserId,
      })),
    )
    .returning();

  log.info("Inserting deals...");
  const deals = await db
    .insert(schema.deals)
    .values([
      {
        name: "Website redesign",
        companyId: companies[0].id,
        status: "proposal-made",
        amount: 50000,
        crmUserId,
      },
      {
        name: "UI/UX audit",
        companyId: companies[1].id,
        status: "opportunity",
        amount: 15000,
        crmUserId,
      },
      {
        name: "Brand copywriting",
        companyId: companies[2].id,
        status: "in-negotiation",
        amount: 8000,
        crmUserId,
      },
      {
        name: "Enterprise license",
        companyId: companies[3].id,
        status: "won",
        amount: 120000,
        crmUserId,
      },
    ])
    .returning();

  log.info("Inserting tasks...");
  await db.insert(schema.tasks).values([
    {
      contactId: contacts[0].id,
      crmUserId,
      type: "call",
      text: "Follow up on proposal",
      dueDate: new Date(Date.now() + 86400000),
    },
    {
      contactId: contacts[2].id,
      crmUserId,
      type: "meeting",
      text: "Discovery call",
      dueDate: new Date(Date.now() + 172800000),
    },
  ]);

  log.info("Inserting notes...");
  await db.insert(schema.contactNotes).values([
    {
      contactId: contacts[0].id,
      crmUserId,
      text: "Met at conference. Interested in Q2.",
    },
    {
      contactId: contacts[4].id,
      crmUserId,
      text: "Closed the deal. Great partnership.",
    },
  ]);
  await db
    .insert(schema.dealNotes)
    .values([
      {
        dealId: deals[0].id,
        crmUserId,
        text: "Sent proposal. Awaiting feedback.",
      },
    ]);

  log.info("Inserting tags...");
  await db.insert(schema.tags).values([
    { name: "VIP", color: "#e88b7d" },
    { name: "Hot", color: "#e8cb7d" },
    { name: "Cold", color: "#7dbde8" },
  ]);

  log.info("Updating configuration...");
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

  log.info({ login: DEMO_USER.email }, "Done! Login with email / admin123");
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    log.error(
      "Refusing to seed in production. Seed creates admin@example.com with a known password. " +
        "Create users via signup or your own provisioning instead.",
    );
    process.exit(1);
  }

  const url =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5435/crm";
  const { db } = createDb(url);
  const crmUserId = await ensureAdminUser(db);
  await seed(db, crmUserId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
