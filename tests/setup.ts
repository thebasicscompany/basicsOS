// Global test setup — runs before all tests
import { vi } from "vitest";

// Mock DB to prevent real connections in integration tests
vi.mock("@basicsos/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  // Export all schema tables as empty stubs
  tenants: { tenantId: "tenantId", id: "id" },
  users: { id: "id", tenantId: "tenantId", role: "role" },
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
  invites: {
    id: "id",
    tenantId: "tenantId",
    token: "token",
    email: "email",
    role: "role",
    acceptedAt: "acceptedAt",
    expiresAt: "expiresAt",
  },
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
}));
