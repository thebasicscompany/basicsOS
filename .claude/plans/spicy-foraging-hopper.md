# Landing Pad Dashboard

## Context

The current dashboard shows stat cards, quick actions, and a module grid — things a founder at a 5-50 person startup doesn't care about. It also auto-redirects to your last route on mount, which means the home screen is essentially invisible. The redesign replaces this with a two-zone "landing pad": your recent work (resume where you left off) and actionable items (what needs attention). No module grid, no stats, no infrastructure status.

## Changes

### 1. Create `apps/web/src/lib/recent-routes.ts` (new)

Shared `RecentRoute` type and utility functions consumed by RouteRecorder, CommandPaletteProvider, and the dashboard page:

```ts
interface RecentRoute {
  path: string;
  moduleId: string;    // "knowledge" | "crm" | "tasks" | etc.
  title: string;       // "Sarah Chen" or "Knowledge Base" for module-level
  timestamp: number;   // Date.now()
}
```

Exports: `RecentRoute`, `RECENT_ROUTES_KEY`, `MAX_RECENT_ROUTES` (8), `readRecentRoutes()`, `moduleIdForPath()`.

### 2. Modify `apps/web/src/components/RouteRecorder.tsx`

- Store `RecentRoute[]` instead of `string[]` in localStorage
- Derive `moduleId` from path prefix via `moduleIdForPath()`
- Capture title from `document.title` after a 300ms delay (lets Next.js set page metadata), strip site suffix, fall back to label map
- Remove the `basicos:last-route` write (no more auto-redirect)
- Increase max from 5 to 8

### 3. Create `packages/api/src/routers/notifications.ts` (new)

The `notifications` table already exists in the DB (written by notification worker) but has no read API. Three procedures:

| Procedure | Access | What it does |
|-----------|--------|-------------|
| `list` | `protectedProcedure` | Unread notifications for `ctx.userId`, ordered `createdAt DESC`, limit 20 |
| `markRead` | `protectedProcedure` | Set `read: true` for given notification IDs |
| `dismiss` | `protectedProcedure` | Delete a notification row |

### 4. Modify `packages/api/src/routers/index.ts`

Register `notificationsRouter` — one import + one key in `appRouter`.

### 5. Modify `apps/web/src/app/(dashboard)/NavClient.tsx`

Wrap the `brandMark` div in `<Link href="/">` so clicking "B" navigates home. The `activeId` computation already returns `undefined` for `/`, so no rail item lights up on the home screen — correct calm/neutral state.

### 6. Modify `apps/web/src/providers/CommandPaletteProvider.tsx`

Adapt to `RecentRoute[]` shape: use `route.path` for navigation, `route.title` for display label. Import `readRecentRoutes` from the new shared utility.

### 7. Replace `apps/web/src/app/(dashboard)/page.tsx`

Complete rewrite. Remove: auto-redirect, stat cards, quick actions, module grid, all four tRPC count queries.

**Layout** (narrow `max-w-3xl`, calm and spacious):

```
Greeting H1 (serif, "Good morning, Alex")

Zone 1: Resume
  SectionLabel "Pick up where you left off"
  Grid (2 cols sm, 4 cols lg) of RecentWorkCard components
  ┌─────────────────────────────────────┐
  │  [IconBadge]  Sarah Chen            │
  │               CRM  ·  2h ago        │
  └─────────────────────────────────────┘
  Empty state: EmptyState with "Navigate to any module..."

Zone 2: Needs Attention
  SectionLabel "Needs attention"
  Compact list of AttentionItem rows
  [icon]  3 overdue tasks                    [View →]
  [icon]  Meeting notes ready — 2 tasks      [View →]  [×]
  [icon]  AI employee output needs review    [View →]
  Empty: "All caught up" text (stone-400)
```

**Data sources:**

| Source | tRPC call | Client-side processing |
|--------|-----------|----------------------|
| Recent work | localStorage `basicos:recent-routes` | Parse `RecentRoute[]`, render top 4 |
| Overdue tasks | `trpc.tasks.getOverdue` | Aggregate into single row with count |
| AI jobs pending | `trpc.aiEmployees.listJobs` | Filter `status === "awaiting_approval"`, aggregate |
| Notifications | `trpc.notifications.list` | Filter out `read === true`, render each as a row |

**Dismiss behavior:** Notification items have an X button that calls `notifications.dismiss` optimistically (remove from local state immediately, mutation fires in background). Overdue tasks and AI jobs link to their module page — no dismiss, just navigate.

**RecentWorkCard** (local component): `Card` with `p-4`, `IconBadge` (module icon + accent colors from `MODULE_ACCENTS`), title in `text-sm font-medium text-stone-900`, module label + relative time in `text-xs text-stone-500`. Hover: `hover:bg-stone-50 transition-colors`.

**AttentionItem** (local component): Full-width flex row, `py-3`, separated by `Separator`. Left: small icon in accent color. Middle: title + optional body. Right: ghost Button linking to actionUrl + optional dismiss X.

**Getting-started state** (no recents AND no attention items): Single `EmptyState` welcoming the user.

## File Summary

| # | File | Action |
|---|------|--------|
| 1 | `apps/web/src/lib/recent-routes.ts` | Create |
| 2 | `apps/web/src/components/RouteRecorder.tsx` | Modify |
| 3 | `packages/api/src/routers/notifications.ts` | Create |
| 4 | `packages/api/src/routers/index.ts` | Modify (1 line) |
| 5 | `apps/web/src/app/(dashboard)/NavClient.tsx` | Modify (wrap brandMark in Link) |
| 6 | `apps/web/src/providers/CommandPaletteProvider.tsx` | Modify (RecentRoute[] shape) |
| 7 | `apps/web/src/app/(dashboard)/page.tsx` | Replace |

## Verification

1. `bun --filter @basicsos/api build` — confirms notifications router types compile
2. `bun --filter @basicsos/web dev` — load `/`, verify greeting + empty state renders
3. Navigate to CRM, Tasks, Meetings, then click "B" brand mark — verify Zone 1 shows 3 recent items with correct titles, icons, timestamps
4. If overdue tasks exist in DB, verify Zone 2 shows them
5. Check `Cmd+K` still works — recent routes show with correct titles
6. Resize to mobile width — verify responsive grid stacks
