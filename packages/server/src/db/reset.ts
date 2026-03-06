/**
 * Reset script: wipes ALL data and re-seeds only structural config.
 * Run: pnpm db:reset
 *
 * After running:
 *   Login: admin@example.com / admin123
 *   Zero demo records — Companies, People, Deals pages are empty.
 *   Object config + attribute overrides are seeded with default field types.
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client.js";
import * as schema from "@/db/schema/index.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5435/crm";

async function main() {
  console.warn("Connecting to database...");
  const { db, close } = createDb(DATABASE_URL);

  try {
    // ── 1. Truncate everything ──────────────────────────────────────────
    console.warn("Truncating all tables...");
    await db.execute(sql`
      TRUNCATE TABLE
        "user",
        "organizations",
        "object_config",
        "configuration",
        "custom_field_defs",
        "tags",
        "favicons_excluded_domains"
      RESTART IDENTITY CASCADE
    `);
    await db.execute(sql`
      TRUNCATE TABLE
        "rbac_permissions",
        "rbac_roles"
      RESTART IDENTITY CASCADE
    `);
    console.warn("All tables truncated.");

    // ── 2. Create admin user + org ──────────────────────────────────────
    console.warn("Creating admin user...");
    const now = new Date();
    const userId = randomUUID();
    const passwordHash = await hashPassword("admin123");

    await db.insert(schema.user).values({
      id: userId,
      name: "Admin User",
      email: "admin@example.com",
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
      .values({ name: "My Organization" })
      .returning();

    const [crmUser] = await db
      .insert(schema.crmUsers)
      .values({
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        userId,
        organizationId: org!.id,
        administrator: true,
      })
      .returning();

    console.warn(`Admin user created (CRM user ID: ${crmUser!.id})`);

    // ── 3. Seed RBAC ────────────────────────────────────────────────────
    console.warn("Seeding RBAC...");
    await db.execute(sql`
      INSERT INTO "rbac_permissions" ("key", "description") VALUES
        ('records.read', 'Read CRM records'),
        ('records.write', 'Create/update CRM records'),
        ('records.delete', 'Soft-delete CRM records'),
        ('records.hard_delete', 'Hard-delete CRM records'),
        ('object_config.write', 'Create/edit objects and fields'),
        ('automation.read', 'View automations'),
        ('automation.write', 'Create/edit automations'),
        ('manage', 'Full admin access')
      ON CONFLICT ("key") DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO "rbac_roles" ("key", "name", "description", "is_system") VALUES
        ('org_admin', 'Organization Admin', 'Full CRM access', true),
        ('member', 'Member', 'Standard CRM collaborator', true)
      ON CONFLICT ("key") DO NOTHING
    `);
    await db.execute(sql`
      WITH role_map AS (SELECT id, key FROM rbac_roles),
           perm_map AS (SELECT id, key FROM rbac_permissions)
      INSERT INTO rbac_role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM role_map r CROSS JOIN perm_map p
      WHERE (r.key = 'org_admin')
         OR (r.key = 'member' AND p.key IN ('records.read','records.write','records.delete','automation.read'))
      ON CONFLICT DO NOTHING
    `);
    await db.execute(sql`
      INSERT INTO rbac_user_roles (crm_user_id, role_id, organization_id)
      SELECT ${crmUser!.id}, r.id, ${org!.id}
      FROM rbac_roles r WHERE r.key = 'org_admin'
      ON CONFLICT DO NOTHING
    `);

    // ── 4. Seed object config ───────────────────────────────────────────
    console.warn("Seeding object config...");
    const orgId = org!.id;

    const [companiesConfig] = await db
      .insert(schema.objectConfig)
      .values({
        slug: "companies",
        singularName: "Company",
        pluralName: "Companies",
        icon: "building-2",
        iconColor: "blue",
        tableName: "companies",
        type: "standard",
        isActive: true,
        position: 0,
        settings: {},
        organizationId: orgId,
      })
      .returning();

    const [contactsConfig] = await db
      .insert(schema.objectConfig)
      .values({
        slug: "contacts",
        singularName: "Person",
        pluralName: "People",
        icon: "users",
        iconColor: "orange",
        tableName: "contacts",
        type: "standard",
        isActive: true,
        position: 1,
        settings: {},
        organizationId: orgId,
      })
      .returning();

    const [dealsConfig] = await db
      .insert(schema.objectConfig)
      .values({
        slug: "deals",
        singularName: "Deal",
        pluralName: "Deals",
        icon: "handshake",
        iconColor: "orange",
        tableName: "deals",
        type: "standard",
        isActive: true,
        position: 2,
        settings: {},
        organizationId: orgId,
      })
      .returning();

    // ── 5. Seed attribute overrides ─────────────────────────────────────
    console.warn("Seeding attribute overrides...");

    const categoryOptions = [
      { id: "b2b", label: "B2B", color: "blue", order: 0 },
      { id: "b2c", label: "B2C", color: "cyan", order: 1 },
      { id: "enterprise", label: "Enterprise", color: "purple", order: 2 },
      { id: "saas", label: "SaaS", color: "teal", order: 3 },
      { id: "marketplace", label: "Marketplace", color: "orange", order: 4 },
      { id: "agency", label: "Agency", color: "pink", order: 5 },
      { id: "consulting", label: "Consulting", color: "indigo", order: 6 },
      { id: "technology", label: "Technology", color: "green", order: 7 },
      { id: "healthcare", label: "Healthcare", color: "red", order: 8 },
      { id: "finance", label: "Finance", color: "amber", order: 9 },
    ];

    const dealStageOptions = [
      { id: "opportunity", label: "Opportunity", color: "blue", order: 0 },
      { id: "proposal-made", label: "Proposal Made", color: "cyan", order: 1 },
      { id: "in-negotiation", label: "In Negotiation", color: "orange", order: 2 },
      { id: "won", label: "Won", color: "green", order: 3, isTerminal: true },
      { id: "lost", label: "Lost", color: "red", order: 4, isTerminal: true },
      { id: "delayed", label: "Delayed", color: "gray", order: 5 },
    ];

    await db.insert(schema.objectAttributeOverrides).values([
      // ── Companies: visible defaults ──
      { objectConfigId: companiesConfig!.id, columnName: "name", displayName: "Company Name", isPrimary: true, config: {}, organizationId: orgId },
      { objectConfigId: companiesConfig!.id, columnName: "domain", displayName: "Domain", uiType: "domain", config: {}, organizationId: orgId },
      { objectConfigId: companiesConfig!.id, columnName: "description", displayName: "Description", uiType: "long-text", config: {}, organizationId: orgId },
      { objectConfigId: companiesConfig!.id, columnName: "category", displayName: "Category", uiType: "multi-select", config: { options: categoryOptions }, organizationId: orgId },

      // ── People: visible defaults ──
      { objectConfigId: contactsConfig!.id, columnName: "first_name", displayName: "First Name", isPrimary: true, config: {}, organizationId: orgId },
      { objectConfigId: contactsConfig!.id, columnName: "last_name", displayName: "Last Name", config: {}, organizationId: orgId },
      { objectConfigId: contactsConfig!.id, columnName: "email", displayName: "Email", uiType: "email", config: {}, organizationId: orgId },
      { objectConfigId: contactsConfig!.id, columnName: "linkedin_url", displayName: "LinkedIn", uiType: "domain", config: {}, organizationId: orgId },
      { objectConfigId: contactsConfig!.id, columnName: "company_id", displayName: "Company", uiType: "company", config: {}, organizationId: orgId },

      // ── Deals: visible defaults ──
      { objectConfigId: dealsConfig!.id, columnName: "name", displayName: "Deal Name", isPrimary: true, config: {}, organizationId: orgId },
      { objectConfigId: dealsConfig!.id, columnName: "company_id", displayName: "Company Name", uiType: "company", config: {}, organizationId: orgId },
      { objectConfigId: dealsConfig!.id, columnName: "status", displayName: "Status", uiType: "status", config: { options: dealStageOptions }, organizationId: orgId },
      { objectConfigId: dealsConfig!.id, columnName: "amount", displayName: "Deal Value", uiType: "currency", config: { currencyCode: "USD", currencySymbol: "$", decimalPlaces: 2, stepAmount: 1000 }, organizationId: orgId },
    ]);

    console.warn("\nReset complete. Database is clean.");
    console.warn("Login: admin@example.com / admin123");
    console.warn("Zero demo records — start fresh.\n");
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
