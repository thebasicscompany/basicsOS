# Long Term Goals

## Route Decomposition (PR #Production Review)

Priority decomposition targets:

- [x] **auth.ts** – Done. Split into `auth/init-signup-invite-routes`, `auth/me-settings-routes`, `auth/organization-routes`.
- [ ] **gateway-chat.ts** – Split into `schemas`, `tool-defs`, `tool-executors`, `thread-store`, `orchestrator`, `route`.
- [x] **views.ts** – Done. Split into `views/column-routes`, `views/filter-routes`, `views/sort-routes`, `views/view-item-routes`, `views/object-routes`, plus `shared`, `mappers`.
- [ ] **Server CRM handlers** – Extract shared session/org/permission resolution into one middleware/helper; extract embedding/event side effects into post-write domain services.
- [ ] **prompt-input.tsx** – Split provider/hooks/attachments/presentation.
- [ ] **SettingsPage.tsx** – Split into account/org/security/connections modules.

### Target organization
- `routes/*` – HTTP only (parsing, status codes, response shape).
- `services/*` – Business orchestration.
- `repositories/*` or `data-access/*` – Drizzle query composition.
- `schemas/*` – Zod contracts and DTO mapping.

---

## AI Memory (Optional, Not a Current Blocker)

- Current state is production-ready for now:
  - Server-side tool calling works for chat and voice assistants.
  - Conversation thread/message persistence works (`ai_threads`, `ai_messages`).
  - Tenant/org isolation is in place.
- Long-term memory (`ai_memory_items`) is not fully wired yet and should be implemented when we need durable personalization across sessions.
- Future implementation scope:
  - Extract stable facts/preferences after assistant turns.
  - Store memory with scope (`org`, `user`, `thread`) + importance/TTL.
  - Retrieve relevant memory and inject into assistant prompts.
  - Add dedupe/update policy to avoid memory bloat and stale data.
