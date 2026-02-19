import { scrypt, randomBytes } from "crypto";
import { db } from "./client.js";
import {
  tenants, users, accounts, invites,
  documents, contacts, companies, deals, dealActivities,
  tasks, meetings, transcripts, meetingSummaries,
  hubLinks, automations,
} from "./schema/index.js";

// Produces hashes compatible with Better Auth's credential provider.
// Same algorithm: scrypt(NFKC(password), hexSalt, 64) → "hexSalt:hexKey"
const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString("hex");
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey as Buffer);
      }
    );
  });
  return `${salt}:${key.toString("hex")}`;
};

const seed = async (): Promise<void> => {
  console.warn("Seeding database with demo data...");

  const [tenant] = await db.insert(tenants).values({
    name: "Acme Corp",
    accentColor: "#6366f1",
    plan: "team",
  }).returning();
  if (!tenant) throw new Error("Failed to create tenant");

  const passwordHash = await hashPassword("password");

  const [admin] = await db.insert(users).values({
    tenantId: tenant.id,
    email: "admin@acme.example.com",
    name: "Alex Chen",
    role: "admin",
    emailVerified: true,
  }).returning();
  if (!admin) throw new Error("Failed to create admin");

  await db.insert(accounts).values({
    accountId: admin.id,
    providerId: "credential",
    userId: admin.id,
    password: passwordHash,
  });

  const [member] = await db.insert(users).values({
    tenantId: tenant.id,
    email: "sarah@acme.example.com",
    name: "Sarah Kim",
    role: "member",
    emailVerified: true,
  }).returning();
  if (!member) throw new Error("Failed to create member");

  await db.insert(accounts).values({
    accountId: member.id,
    providerId: "credential",
    userId: member.id,
    password: passwordHash,
  });

  await db.insert(invites).values({
    tenantId: tenant.id,
    email: "new@acme.example.com",
    role: "member",
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Knowledge docs
  const [rootDoc] = await db.insert(documents).values({
    tenantId: tenant.id,
    title: "Engineering Handbook",
    contentJson: { type: "doc", content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Engineering Handbook" }] },
      { type: "paragraph", content: [{ type: "text", text: "Welcome to Acme Corp's engineering guide. This document covers our stack, processes, and best practices." }] },
    ]},
    position: 0, createdBy: admin.id,
  }).returning();

  await db.insert(documents).values([
    { tenantId: tenant.id, title: "Onboarding Guide",
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Follow these steps to get set up on your first day at Acme Corp." }] }] },
      position: 1, createdBy: admin.id },
    { tenantId: tenant.id, title: "Product Roadmap Q1 2026",
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Q1 priorities: AI integrations, mobile app launch, enterprise SSO." }] }] },
      position: 2, createdBy: admin.id },
    { tenantId: tenant.id, parentId: rootDoc?.id ?? null, title: "Tech Stack Overview",
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Frontend: Next.js 15. Backend: tRPC + Hono. Database: PostgreSQL + pgvector." }] }] },
      position: 0, createdBy: admin.id },
  ]);

  // CRM
  const [globalCo] = await db.insert(companies).values({ tenantId: tenant.id, name: "GlobalTech Inc", domain: "globaltech.io", industry: "Technology", customFields: {} }).returning();
  const [startup] = await db.insert(companies).values({ tenantId: tenant.id, name: "StartupXYZ", domain: "startupxyz.com", industry: "SaaS", customFields: {} }).returning();

  const [mehmet] = await db.insert(contacts).values({ tenantId: tenant.id, name: "Mehmet Yilmaz", email: "mehmet@globaltech.io", phone: "+1 415 555 0123", companyId: globalCo?.id ?? null, customFields: {}, createdBy: admin.id }).returning();
  const [priya] = await db.insert(contacts).values({ tenantId: tenant.id, name: "Priya Sharma", email: "priya@startupxyz.com", companyId: startup?.id ?? null, customFields: {}, createdBy: admin.id }).returning();
  await db.insert(contacts).values({ tenantId: tenant.id, name: "James Walker", email: "james@example.com", customFields: {}, createdBy: admin.id });

  const bigDealRow = await db.insert(deals).values({ tenantId: tenant.id, companyId: globalCo?.id ?? null, contactId: mehmet?.id ?? null, title: "GlobalTech Enterprise License", stage: "negotiation", value: "48000", probability: 75, closeDate: new Date("2026-03-31"), createdBy: admin.id }).returning();
  const bigDeal = bigDealRow[0];
  await db.insert(deals).values([
    { tenantId: tenant.id, companyId: startup?.id ?? null, contactId: priya?.id ?? null, title: "StartupXYZ Team Plan", stage: "proposal", value: "9900", probability: 50, createdBy: admin.id },
    { tenantId: tenant.id, title: "Inbound Lead — TechConf", stage: "lead", value: "5000", probability: 20, createdBy: member.id },
    { tenantId: tenant.id, title: "Renewal — Beta Customer", stage: "won", value: "12000", probability: 100, createdBy: admin.id },
  ]);

  if (bigDeal) {
    await db.insert(dealActivities).values([
      { dealId: bigDeal.id, type: "call", content: "30-min discovery call. Mehmet is interested in enterprise tier. Needs CFO approval.", createdBy: admin.id },
      { dealId: bigDeal.id, type: "email", content: "Sent pricing proposal for the enterprise package. Awaiting review.", createdBy: admin.id },
    ]);
  }

  // Tasks
  await db.insert(tasks).values([
    { tenantId: tenant.id, title: "Set up CI/CD pipeline", status: "done", priority: "high", assigneeId: admin.id, createdBy: admin.id },
    { tenantId: tenant.id, title: "Write product specs for Q2 features", status: "in-progress", priority: "high", assigneeId: member.id, dueDate: new Date("2026-03-15"), createdBy: admin.id },
    { tenantId: tenant.id, title: "Follow up with GlobalTech after demo", status: "todo", priority: "urgent", assigneeId: admin.id, dueDate: new Date("2026-02-20"), createdBy: admin.id },
    { tenantId: tenant.id, title: "Review onboarding guide", status: "todo", priority: "medium", createdBy: member.id },
    { tenantId: tenant.id, title: "Update privacy policy", status: "todo", priority: "low", dueDate: new Date("2026-04-01"), createdBy: admin.id },
  ]);

  // Meetings
  const [mtg1] = await db.insert(meetings).values({ tenantId: tenant.id, title: "Q1 Planning — All Hands", startedAt: new Date("2026-02-10T10:00:00Z"), endedAt: new Date("2026-02-10T11:00:00Z"), createdBy: admin.id }).returning();
  const [mtg2] = await db.insert(meetings).values({ tenantId: tenant.id, title: "GlobalTech Demo Call", startedAt: new Date("2026-02-14T14:00:00Z"), endedAt: new Date("2026-02-14T14:45:00Z"), createdBy: admin.id }).returning();

  if (mtg1) {
    await db.insert(transcripts).values([
      { tenantId: tenant.id, meetingId: mtg1.id, speaker: "Alex Chen", text: "Let's review our Q1 goals. We need to ship the mobile app by end of March.", timestampMs: 0 },
      { tenantId: tenant.id, meetingId: mtg1.id, speaker: "Sarah Kim", text: "I can take the lead on mobile UI. I'll need design specs by next week.", timestampMs: 15000 },
      { tenantId: tenant.id, meetingId: mtg1.id, speaker: "Alex Chen", text: "Enterprise SSO is also a priority — two prospects are waiting on it.", timestampMs: 32000 },
    ]);
    await db.insert(meetingSummaries).values({ tenantId: tenant.id, meetingId: mtg1.id, summaryJson: { decisions: ["Ship mobile app by end of March", "Enterprise SSO is Q1 priority"], actionItems: ["Sarah to start mobile UI once specs arrive", "Alex to follow up with SSO prospects"], followUps: ["Design review Feb 17"], note: "Q1 All Hands" } });
  }
  if (mtg2) {
    await db.insert(transcripts).values([
      { tenantId: tenant.id, meetingId: mtg2.id, speaker: "Mehmet Yilmaz", text: "This is exactly what we need. The AI assistant would save my team hours every week.", timestampMs: 0 },
      { tenantId: tenant.id, meetingId: mtg2.id, speaker: "Alex Chen", text: "The enterprise plan includes unlimited users and priority support. I'll send the contract today.", timestampMs: 20000 },
    ]);
    await db.insert(meetingSummaries).values({ tenantId: tenant.id, meetingId: mtg2.id, summaryJson: { decisions: ["Mehmet wants to proceed with enterprise license"], actionItems: ["Alex to send contract by EOD", "Mehmet to loop in CFO"], followUps: ["Contract review call Feb 18"], note: "Demo — high close probability" } });
  }

  // Hub links
  await db.insert(hubLinks).values([
    { tenantId: tenant.id, title: "GitHub", url: "https://github.com", icon: "🐙", category: "Engineering", position: 0 },
    { tenantId: tenant.id, title: "Figma", url: "https://figma.com", icon: "🎨", category: "Design", position: 1 },
    { tenantId: tenant.id, title: "Linear", url: "https://linear.app", icon: "📋", category: "Engineering", position: 2 },
    { tenantId: tenant.id, title: "Slack", url: "https://slack.com", icon: "💬", category: "Communication", position: 3 },
    { tenantId: tenant.id, title: "Google Drive", url: "https://drive.google.com", icon: "📁", category: "Docs", position: 4 },
  ]);

  // Automations
  await db.insert(automations).values([
    { tenantId: tenant.id, name: "New Contact → Notify Team", triggerConfig: { eventType: "crm.contact.created", conditions: [] }, actionChain: [{ type: "post_slack", config: { channel: "#sales", message: "New contact added!" } }], enabled: true },
    { tenantId: tenant.id, name: "Deal Won → Create Onboarding Task", triggerConfig: { eventType: "crm.deal.won", conditions: [] }, actionChain: [{ type: "create_task", config: { title: "Start customer onboarding" } }], enabled: true },
  ]);

  console.warn(`
╔════════════════════════════════════════╗
║   ✅  Demo data seeded successfully!   ║
╚════════════════════════════════════════╝

  Tenant:  Acme Corp
  Admin:   admin@acme.example.com
  Member:  sarah@acme.example.com

  Seeded:
    📚  4 knowledge documents (1 nested)
    🤝  2 companies · 3 contacts · 4 deals
    ✅  5 tasks (todo/in-progress/done)
    🎯  2 meetings with transcripts
    🔗  5 hub links
    ⚡  2 automations

  Open http://localhost:3000 to explore!
`);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
