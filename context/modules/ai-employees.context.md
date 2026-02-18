# AI Employees Module Context

## Overview
The AI Employees module manages long-running autonomous AI agent jobs within Basics OS tenants. It exposes a tRPC router at `packages/api/src/routers/ai-employees.ts` mounted as `aiEmployees` on the `appRouter`.

Phase 1 is a stub — E2B sandbox integration is deferred to production. Jobs are created and tracked in the database; actual execution is wired in a later phase.

## Structure
The `aiEmployeesRouter` manages two related tables:
- **AI Employee Jobs** — tenant-scoped job records with title, instructions, status lifecycle, and cost tracking
- **AI Employee Outputs** — outputs produced by a job, supporting an approval workflow before actions are applied

## Procedures

### Jobs
- `listJobs` — `protectedProcedure` query returning all jobs for the tenant
- `getJob` — `protectedProcedure` query returning a single job by UUID along with its outputs; throws `NOT_FOUND` if absent or in a different tenant
- `createJob` — `memberProcedure` mutation inserting a new job with `pending` status; emits `ai_employee.started` event
- `kill` — `adminProcedure` mutation setting job status to `killed`; emits `ai_employee.killed` event; throws `NOT_FOUND` if absent

### Outputs
- `listOutputs` — `protectedProcedure` query returning all outputs for a job; verifies the job belongs to the tenant
- `approveOutput` — `memberProcedure` mutation clearing the `requiresApproval` flag and stamping `approvedAt`/`approvedBy`; throws `NOT_FOUND` if output is absent or `FORBIDDEN` if the parent job belongs to a different tenant

## Events Emitted
- `ai_employee.started` — fired after `createJob` succeeds, carrying `jobId`
- `ai_employee.killed` — fired after `kill` succeeds, carrying `jobId`

## Status Lifecycle
`pending` → `running` → `awaiting_approval` → `completed` | `failed` | `killed`

Status transitions beyond `pending` are driven by the E2B worker (deferred to Phase 2).

## Tenant Isolation
All queries are scoped to `ctx.tenantId`. `protectedProcedure` reads check `tenantId` at runtime and throw `UNAUTHORIZED` if missing. `memberProcedure` and `adminProcedure` receive `tenantId` as a guaranteed non-null string from the middleware.

## Key Files
- `packages/api/src/routers/ai-employees.ts` — router implementation
- `packages/api/src/routers/ai-employees.test.ts` — unit tests with mocked DB
- `packages/db/src/schema/ai-employees.ts` — Drizzle table definitions (`aiEmployeeJobs`, `aiEmployeeOutputs`)
