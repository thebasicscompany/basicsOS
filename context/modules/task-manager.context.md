# Task Manager Module

## Overview
The Task Manager provides CRUD operations and lifecycle event emission for tasks within a tenant. It is exposed via the `tasks` tRPC router at `packages/api/src/routers/tasks.ts`.

## Status and Priority Enums
Tasks carry two classification fields:
- **status**: `todo` | `in-progress` | `done` — tracks work state; defaults to `todo`
- **priority**: `low` | `medium` | `high` | `urgent` — controls urgency weighting; defaults to `medium`

## Source Linking
Tasks can originate from automated processes. The `sourceType` / `sourceId` pair links a task back to its origin:
- `sourceType`: `meeting` | `automation` | `ai-employee` — identifies the originating module
- `sourceId`: UUID of the originating record in that module's table

This enables downstream queries like "show all tasks created from meeting X" and allows the meeting processor, automation executor, and AI employee workers to create tasks without duplicating attribution logic.

## Cross-Module Integration
- **Event Bus**: The router emits `task.created`, `task.completed`, and `task.assigned` events on the shared `EventBus` after each mutation so that other modules (notification dispatcher, audit logger, automation triggers) can react without coupling.
- **Auth**: `list` and `get` require `protectedProcedure` (any authenticated user within the tenant). Mutations (`create`, `update`, `delete`) require `memberProcedure` — viewers are rejected with 403.
- **Overdue detection**: `getOverdue` queries tasks where `dueDate < now AND status != done`, used by notification workers and dashboard summaries.
