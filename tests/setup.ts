// Global test setup — runs before all tests
import { vi } from "vitest";

// Mock DB to prevent real connections in integration tests
vi.mock("@basicsos/db", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(),
  };
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
  return {
  db,
  // Auth-required exports (packages/auth/src/config.ts)
  users: { id: "id", name: "name", email: "email", role: "role", tenantId: "tenantId", onboardedAt: "onboardedAt", createdAt: "createdAt" },
  sessions: { id: "id", userId: "userId", token: "token", expiresAt: "expiresAt" },
  accounts: { id: "id", userId: "userId", providerId: "providerId", accountId: "accountId" },
  verifications: { id: "id", identifier: "identifier", value: "value", expiresAt: "expiresAt" },
  tenants: { id: "id", name: "name", slug: "slug", createdAt: "createdAt" },
  invites: { id: "id", tenantId: "tenantId", email: "email", role: "role", token: "token", acceptedAt: "acceptedAt", expiresAt: "expiresAt", createdAt: "createdAt" },
  // Module schema tables
  documents: { id: "id", tenantId: "tenantId" },
  contacts: { id: "id", tenantId: "tenantId" },
  deals: { id: "id", tenantId: "tenantId", stage: "stage", value: "value" },
  tasks: {
    id: "id",
    tenantId: "tenantId",
    status: "status",
    priority: "priority",
    assigneeId: "assigneeId",
    sourceType: "sourceType",
    dueDate: "dueDate",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  automations: {
    id: "id",
    tenantId: "tenantId",
    enabled: "enabled",
    triggerConfig: "triggerConfig",
    actionChain: "actionChain",
  },
  automationRuns: { id: "id", automationId: "automationId" },
  meetings: { id: "id", tenantId: "tenantId" },
  meetingParticipants: { id: "id", tenantId: "tenantId", meetingId: "meetingId" },
  transcripts: { id: "id", tenantId: "tenantId", meetingId: "meetingId" },
  meetingSummaries: { id: "id", tenantId: "tenantId", meetingId: "meetingId" },
  hubLinks: { id: "id", tenantId: "tenantId", position: "position" },
  integrations: { id: "id", tenantId: "tenantId", service: "service", connectedAt: "connectedAt" },
  aiEmployeeJobs: { id: "id", tenantId: "tenantId", status: "status" },
  aiEmployeeOutputs: {
    id: "id",
    jobId: "jobId",
    requiresApproval: "requiresApproval",
    approvedAt: "approvedAt",
    approvedBy: "approvedBy",
  },
  auditLog: { id: "id", tenantId: "tenantId" },
};});
