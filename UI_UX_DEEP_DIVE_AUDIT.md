# UI/UX Deep Dive Audit

Date: 2026-03-03
Scope: React web app + desktop voice overlay + navigation architecture

## Executive Summary

The app has strong core building blocks (Shadcn primitives, route-based composition, generic object pages), but there are several UX trust and consistency issues:

1. Capability mismatch between UI and backend behavior in a few high-traffic areas.
2. Navigation and shortcut semantics diverge across shells.
3. Microcopy and typography are inconsistent (including developer placeholder leakage).
4. Voice overlay UI is effectively a separate design system with hardcoded styling.

If fixed, the product will feel materially more reliable and cohesive without a major rewrite.

## Findings (Prioritized)

### 1) Shortcut semantics are inconsistent across surfaces (High)
- Evidence:
  - `src/components/app-sidebar.tsx:25` dispatches `ctrlKey: true` but the UI shows `Cmd+K` at `src/components/app-sidebar.tsx:37` and `:44`.
  - `packages/hub/src/HubSidebar.tsx:80` dispatches `ctrlKey: true` but UI shows `Cmd+K` at `packages/hub/src/HubSidebar.tsx:74` and `:89`.
- UX impact: Mac users are told one thing, behavior is implemented as another. This causes trust loss and support friction.
- Recommendation: Centralize shortcut rendering and dispatch via a platform-aware helper (`metaKey` on macOS, `ctrlKey` otherwise).

### 2) Stub/placeholder capability is exposed in production UI flows (High)
- Evidence:
  - Voice UI advertises a stub: `packages/voice/src/VoiceApp.tsx:95`.
  - Runtime flash messages expose stub behavior: `src/overlay/lib/use-meeting-controls.tsx:58` and `:86`.
- UX impact: Users hit dead ends in primary interaction loops.
- Recommendation: Gate these with feature flags and hide unavailable actions by default.

### 3) Copy bug leaked to UI: "FunnelIcon" label (High)
- Evidence: `src/components/data-table/DataTableToolbar.tsx:133`.
- UX impact: Reduces product polish and confidence, especially in data-heavy views.
- Recommendation: Replace with "Filter" and add a copy lint check for component/token names in UI strings.

### 4) File attachment affordance is shown but not truly supported (High)
- Evidence:
  - Chat allows adding files and toasts that files are attached: `src/components/pages/ChatPage.tsx:107-110`.
  - Same toast explicitly says assistant currently supports text only.
- UX impact: Violates user expectation after action completion feedback.
- Recommendation: Either disable attachment UI until supported, or fully support file ingestion end-to-end.

### 5) Duplicate navigation systems drift in naming and IA (Medium)
- Evidence:
  - Main app labels: `src/config/sidebar-nav.ts:21-23` (`Voice`, `MCP`).
  - Hub labels: `packages/hub/src/HubSidebar.tsx:35-36` (`Launch Voice Native`, `View Custom MCP`).
- UX impact: Same destinations have different mental models depending on entry shell.
- Recommendation: One shared nav config package consumed by both sidebars.

### 6) Record detail tabs expose unfinished sections (Medium)
- Evidence:
  - "Activity" placeholder: `src/components/pages/RecordDetailPage.tsx:126-129`.
  - "Tasks" placeholder: `src/components/pages/RecordDetailPage.tsx:139-142`.
- UX impact: Users interpret empty placeholders as broken features.
- Recommendation: Hide unfinished tabs or show "Coming soon" with clear intent and timeline.

### 7) Accessibility gaps in dense task interactions (Medium)
- Evidence:
  - Task toggle button has no label: `src/components/pages/TasksPage.tsx:90-96`.
  - Contact action button has no label: `src/components/pages/TasksPage.tsx:106-111`.
- UX impact: Screen-reader and keyboard users lose context in repetitive rows.
- Recommendation: Add `aria-label` with task/contact context and verify tab order.

### 8) Typography is consistently undersized for core workflows (Medium)
- Evidence:
  - Heavy use of `text-[11px]`, `text-[12px]`, `text-[13px]` across settings/profile/tasks/tables.
  - Examples: `src/components/pages/SettingsPage.tsx:116`, `src/components/pages/ProfilePage.tsx:97`, `src/components/pages/TasksPage.tsx:377`.
- UX impact: Reduced readability and increased visual fatigue.
- Recommendation: Define a type scale token policy (e.g., body >= 14px for primary copy, metadata >= 12px).

### 9) Auth/route semantics still carry legacy path assumptions (Medium)
- Evidence:
  - Login callback and navigate use `/contacts`: `src/components/auth/login-page.tsx:28` and `:33`.
  - Signup fallback navigates to `/login` even though public route is `/`/`/sign-up`: `src/components/auth/signup-page.tsx:46`.
  - Start page comment still references old path: `src/components/auth/start-page.tsx:10`.
- UX impact: Increased chance of edge-case routing confusion and maintenance bugs.
- Recommendation: Route constants for auth and post-login targets; remove legacy literals.

### 10) Overlay UI is a parallel styling system with hardcoded inline values (Medium)
- Evidence:
  - `src/overlay/OverlayApp.tsx:324-609` uses extensive inline style + hardcoded colors.
  - `src/overlay/lib/pill-components.tsx` also embeds visual constants and custom SVG behavior.
- UX impact: Difficult to maintain visual consistency with web app themes/tokens.
- Recommendation: Introduce shared design tokens for overlay (colors, spacing, radii, typography) and map to CSS vars.

### 11) Dead/unused toolbar component contains divergent UX patterns (Low)
- Evidence:
  - `DataTableToolbar` exists but no usage found in source search.
- UX/architecture impact: Drift risk, duplicate maintenance surface.
- Recommendation: Remove or re-integrate with one canonical table action pattern.

## Architecture and UX Improvements (What to do instead)

### A) Capability-driven UI (highest leverage)
- Create a `capabilities` endpoint (or bootstrap payload) that includes booleans like:
  - `voice.meetingRecording`
  - `chat.fileAttachments`
  - `assistant.crmWriteActions`
- Render/disable UI from these capabilities instead of hardcoded assumptions.
- Benefit: Removes trust-breaking dead-end interactions.

### B) Single navigation contract
- Move all labels/paths/icons into one shared config consumed by:
  - `src/components/app-sidebar.tsx`
  - `packages/hub/src/HubSidebar.tsx`
  - command palette grouping labels
- Benefit: IA consistency and lower maintenance cost.

### C) Tokenize overlay visual system
- Add overlay CSS vars for spacing/radii/color/text size and stop hardcoding values in JSX style objects.
- Benefit: theming parity and easier iteration.

### D) Route hygiene completion
- Replace auth/legacy hardcoded strings with route constants.
- Keep redirects, but stop using legacy paths as primary success destinations.
- Benefit: fewer routing regressions as the app evolves.

## 30-Day Remediation Plan

### Week 1 (quick wins)
- Fix shortcut dispatch/render mismatch.
- Fix "FunnelIcon" string.
- Add missing aria labels in task row actions.
- Remove or hide tabs and voice controls that are still stubs.

### Week 2
- Unify nav labels and route targets from a shared config.
- Normalize auth flow destinations to canonical routes.
- Update helper text and docs to reflect current behavior only.

### Week 3-4
- Implement capability-driven rendering.
- Refactor overlay styles to token-based theming.
- Delete or reintegrate dead table-toolbar pattern.

## Success Metrics

- Fewer UX trust errors: reduction in "clicked but unavailable" feedback.
- Faster task completion in usability pass for navigation and task management.
- Lower UI bug churn in copy/label regressions.
- Accessibility score uplift on key screens (Tasks, Settings, Chat).
