# BasicsOS Codebase Audit — Comprehensive TODO

This document summarizes dead/deprecated code, refactoring opportunities, incomplete features, and UI/UX gaps discovered during a full codebase audit.

---

## 1. Dead / Deprecated Code

### 1.1 Demo app (broken)
- **Location:** `demo/App.tsx`
- **Issue:** Imports from `@/components/atomic-crm/root/CRM` and `@/components/atomic-crm/providers/fakerest` — the `atomic-crm` directory does not exist (0 files found). The demo app will fail to build/run.
- **Action:** Either fix the demo by pointing to the correct architecture (ObjectListPage, RecordDetailPage, etc.) or remove the demo if it’s obsolete.

### 1.2 Outdated AGENTS.md documentation
- **Location:** `AGENTS.md`
- **Issue:** Describes `src/components/atomic-crm/`, `src/components/admin/`, Supabase/FakeRest as primary data providers, and `<CRM>` component configuration. The current app uses `ObjectListPage`, `RecordDetailPage`, and a REST API—no atomic-crm or admin components.
- **Action:** Update AGENTS.md to reflect the current architecture (ObjectRegistry, views, NocoDB-style tables, etc.).

### 1.3 Connections page never rendered
- **Location:** `src/components/pages/ConnectionsPage.tsx`, `src/App.tsx`
- **Issue:** Route `/connections` uses `RedirectToSettingsConnections` → `Navigate to="/settings#connections"`. ConnectionsPage is never rendered; its `useEffect` handling `?connected=` for OAuth success toast is dead.
- **Action:** Either render ConnectionsPage at `/connections` (and remove the redirect), or move the `?connected=` handling into SettingsPage and preserve query params when redirecting.

### 1.4 Assistant route usage unclear
- **Location:** `packages/server/src/routes/assistant.ts` (mounted at `/assistant`)
- **Issue:** Chat uses `gateway-chat` (`/api/gateway-chat`). No frontend references `/assistant`. May be for external consumers; add comment or document intended usage.

---

## 2. Refactoring Opportunities

### 2.1 Duplicate topological sort / graph traversal
- **Locations:**
  - `packages/server/src/lib/automation-executor.ts` (Kahn’s algorithm)
  - `packages/automations/src/WorkflowPropertiesSheet.tsx` (`getWorkflowNodeOrder`)
  - `packages/automations/src/useAvailableVariables.ts` (`getAncestorOrder`)
- **Issue:** Same adjacency + in-degree + topological sort logic copy-pasted in 3 places.
- **Action:** Extract a shared `topologicalSort(nodes, edges)` utility in `@basics-os/shared` or a shared lib, and reuse it.

### 2.2 FIXME in shared auth
- **Location:** `packages/shared/src/auth/canAccess.ts`
- **Issue:** `// FIXME: This should be exported from the ra-core package` — local type/workaround for ra-core.
- **Action:** Resolve by exporting from ra-core if possible, or document why this local definition is needed.

### 2.3 TypeScript / ESLint suppressions
- **Locations:**
  - `packages/server/src/routes/crm/handlers/get-one.ts`, `list.ts`: `@ts-expect-error` for Drizzle `SelectedFields` typing with spread/joined cols.
  - `packages/server/src/lib/automation-engine.ts`: Multiple `eslint-disable-next-line @typescript-eslint/no-explicit-any`
  - `packages/automations/src/WorkflowPropertiesSheet.tsx`, `AutomationBuilderPage.tsx`: `eslint-disable-line react-hooks/exhaustive-deps`
- **Action:** Replace with proper types or refactors where feasible; add short comments for suppressions that must remain.

### 2.4 Debug log remnant
- **Location:** `src/main/index.ts`
- **Issue:** `ipcMain.on("ping", () => console.log("pong"));` — Electron IPC ping handler with console.log.
- **Action:** Remove or replace with structured logging if needed.

### 2.5 Typo in constants
- **Location:** `src/components/deals/DealsKanbanBoard.tsx`
- **Issue:** `"in-negociation"` should be `"in-negotiation"`.
- **Action:** Fix typo and ensure DB/stage values are aligned (migration if necessary).

---

## 3. Incomplete / Stub Features

### 3.1 Voice app (full stub)
- **Location:** `packages/voice/src/VoiceApp.tsx`
- **Issue:** Single card with “Voice Native (Wispr) integration coming soon.”
- **Action:** Implement or remove from nav if not planned soon.

### 3.2 Chat file attachments
- **Location:** `src/components/pages/ChatPage.tsx`
- **Issue:** Toast says “The assistant currently supports text only” when files are attached.
- **Action:** Either implement file handling or hide/disable attachment UI until supported.

### 3.3 CRM action: missing `update_deal`
- **Location:** `packages/server/src/lib/automation-actions/crm-action.ts`
- **Issue:** Supports `create_task`, `create_contact`, `create_note`, `create_deal_note`. AI agent has `updateDeal`; automations do not.
- **Action:** Add `update_deal` to CRM action if users should update deal stage from automations.

### 3.4 Variable picker gaps
- **Location:** `packages/automations/src/useAvailableVariables.ts`
- **Issue:** Outputs for `action_slack`, `action_gmail_send`, `action_email` are not exposed. `slack_result` exists in executor context but is not in the variable picker.
- **Action:** Add `slack_result`, `gmail_messages` (for gmail_read) if missing, and document which actions produce outputs.

---

## 4. UI/UX Gaps

### 4.1 OAuth redirect drops query params
- **Location:** `src/App.tsx` `RedirectToSettingsConnections`
- **Issue:** `Navigate to="/settings#connections"` discards `?connected=slack` (or similar) from OAuth callback. Success toast in ConnectionsPage never runs.
- **Action:** Preserve query params when redirecting, e.g. `to={`/settings${searchParams.toString() ? `?${searchParams}` : ''}#connections`}` and handle `connected` in Settings/ConnectionsContent.

### 4.2 Connections route UX
- **Issue:** Sidebar links to “Connections” but `/connections` immediately redirects to Settings. Users may expect a standalone Connections page.
- **Action:** Either keep as redirect and add helper text in Settings, or expose a dedicated Connections page.

### 4.3 Kanban board loading
- **Location:** `src/components/deals/DealsKanbanBoard.tsx`
- **Issue:** Uses `Skeleton` when `isPending`, but layout/structure during loading could be clearer.
- **Action:** Reuse or align with DataTable loading pattern for consistency.

### 4.4 Automation node config: raw ID inputs
- **Location:** `packages/automations/src/NodeConfigPanel.tsx`
- **Issue:** CRM action fields (contactId, dealId) are plain text. No contact/deal picker or typeahead.
- **Action:** Add VariablePicker integration and/or entity selector for these IDs to reduce errors.

### 4.5 Empty states and error recovery
- **Locations:** Various list/detail pages
- **Issue:** Some error states only show text; no retry button or guidance.
- **Action:** Add retry/refresh actions to error states where appropriate.

### 4.6 Dashboard
- **Issue:** Dashboard content and layout not audited in depth.
- **Action:** Review chart-area, section-cards, and empty-state UX for consistency and responsiveness.

---

## Summary Priority Matrix

| Priority | Category  | Item |
|----------|-----------|------|
| P0       | Dead      | Fix or remove broken demo app |
| P0       | UX        | Preserve OAuth `?connected=` when redirecting to Settings |
| P1       | Docs      | Update AGENTS.md to match current architecture |
| P1       | Refactor  | Extract shared topological sort utility |
| P1       | Stub      | Add `update_deal` to CRM automation action (if needed) |
| P2       | Dead      | Clarify Connections page vs redirect; fix or remove dead logic |
| P2       | Refactor  | Address FIXME in `canAccess.ts` |
| P2       | Stub      | Implement or hide Voice app; document assistant route usage |
| P2       | UX        | Add entity picker for contactId/dealId in automation CRM nodes |
| P3       | Refactor  | Fix `in-negociation` typo; reduce eslint/ts suppressions |
| P3       | UX        | Improve error-state retry/refresh across pages |

---

## Files to Update (Quick Reference)

- `demo/App.tsx` — fix or remove
- `AGENTS.md` — align with current architecture
- `src/App.tsx` — preserve query params in `RedirectToSettingsConnections`
- `packages/shared/src/auth/canAccess.ts` — resolve FIXME
- `src/components/deals/DealsKanbanBoard.tsx` — fix typo
- `packages/server/src/lib/automation-actions/crm-action.ts` — consider `update_deal`
- `packages/automations/src/useAvailableVariables.ts` — add missing outputs
- Create shared `topologicalSort` utility and refactor 3 call sites
