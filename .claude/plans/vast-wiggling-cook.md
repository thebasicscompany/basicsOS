# Dashboard Redesign: Landing Pad (Recent Work + Needs Attention)

## Context

The current dashboard shows vanity stats (counts), a module grid, and quick-action buttons — none of which serve the actual user need. Per the product concept: **the dashboard should be a landing pad**, not a dashboard. The user opens the app to continue work or check what changed. The less time on the home screen, the better.

## Design Summary

Two zones, stacked vertically. Spacious. Calm. No stats grid, no module grid.

**Zone 1 — Resume (top, most visual space)**
3-5 recent work items as medium cards. Not "recently used modules" — recently used *things*. Each card shows: item title, module badge (with accent color), and relative timestamp. Click → navigate back to that exact route.

**Zone 2 — Needs Attention (compact inbox below)**
Actionable items from across modules. Each has a description + module source + action link. Items: overdue tasks, assigned tasks, meetings with ready summaries. This list should feel like an inbox — act on it and it shrinks.

**Empty state**: New user with no recent work → show a getting-started message with links to explore modules.

---

## Files to Modify

### 1. `apps/web/src/components/RouteRecorder.tsx`
**Enhance to store rich route objects instead of plain strings.**

Current: stores `string[]` (just paths) in `basicos:recent-routes`.

New: stores `RecentRoute[]` objects:
```ts
type RecentRoute = {
  path: string;
  title: string;    // from document.title
  module: string;   // derived from path prefix ("knowledge", "crm", etc.)
  timestamp: number; // Date.now()
};
```

- After setting `basicos:last-route`, use a short `requestAnimationFrame` + `document.title` read to capture the page title
- Derive module from path prefix using existing `ALLOWED_PREFIXES`
- Store up to 8 items (deduped by path)
- **Backwards compatible**: if old `string[]` data exists in localStorage, migrate it on read

### 2. `apps/web/src/app/(dashboard)/page.tsx`
**Complete rewrite — remove stats grid, module grid, quick actions.**

New structure:
```tsx
<div>
  {/* Greeting — keep serif H1, simplify subtitle */}
  <h1 className="font-serif ...">Good morning, Alex</h1>

  {/* Zone 1: Resume — recent work cards */}
  <SectionLabel>Pick up where you left off</SectionLabel>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {recentRoutes.map(route => (
      <RecentWorkCard route={route} />
    ))}
  </div>

  {/* Zone 2: Needs Attention — compact list */}
  <SectionLabel>Needs your attention</SectionLabel>
  <div className="space-y-2">
    {attentionItems.map(item => (
      <AttentionItem item={item} />
    ))}
  </div>

  {/* Empty state if nothing */}
  {noItems && <EmptyState ... />}
</div>
```

**Data fetching** (all existing endpoints, no API changes):
- Recent routes: read from `basicos:recent-routes` localStorage
- Overdue tasks: `trpc.tasks.getOverdue.useQuery()`
- My tasks (assigned, not done): `trpc.tasks.list.useQuery({ assigneeId: userId, status: "todo" })` + `status: "in_progress"`
- Recent meetings with summaries: `trpc.meetings.list.useQuery({ limit: 3 })`

**RecentWorkCard** (inline component):
- `Card` with module icon (from `MODULE_ACCENTS`), title, module label badge, relative time
- On click → `router.push(route.path)`
- Module accent color as left border or icon tint

**AttentionItem** (inline component):
- Compact row: icon + description + module badge + "View" link
- Overdue task → red accent, "Task overdue: {title}" → links to `/tasks`
- Assigned task → emerald accent, "{title} assigned to you" → links to `/tasks`
- Meeting summary ready → violet accent, "Summary ready: {title}" → links to `/meetings/{id}`

### 3. `packages/shared/src/constants/module-accents.ts`
**No changes needed** — already has all the accent data we need.

### 4. `apps/web/src/providers/CommandPaletteProvider.tsx`
**Update `getRecentRoutes()` to handle new `RecentRoute[]` format.**

The command palette reads `basicos:recent-routes` for its "Recent" group. Update it to parse the new object format and extract `.path` for navigation and `.title` for display (falling back to `labelForRoute` if title is missing).

---

## Key Decisions

1. **No new API endpoints** — Phase 1 uses only existing tRPC procedures. The "recent work" list is powered by localStorage (client-side route history), not a server-side activity feed. This is fast, works offline, and requires zero backend work.

2. **No module grid** — Navigation lives in the sidebar (IconRail) and command palette (Cmd+K). Duplicating it on the home screen wastes space.

3. **No stats** — Aggregate counts ("12 Tasks", "5 Meetings") don't help users do anything. Remove them.

4. **Spacious layout** — Generous spacing between zones. The home screen is the least dense screen in the app.

5. **RecentWorkCard title source** — `document.title` is set by Next.js page metadata. Using `requestAnimationFrame` after pathname change ensures the title has updated. Fallback to path-based label if title is empty/generic.

---

## Verification

1. `npx tsc --noEmit` in `apps/web` — type-check
2. `bun --filter @basicsos/web dev` — visual check:
   - Greeting shows with serif font
   - Recent work cards show with module icons + accent colors + timestamps
   - Clicking a card navigates to the correct route
   - Overdue tasks appear in "Needs attention"
   - Empty state shows for new users
   - No stats grid, no module grid
3. Verify `RouteRecorder` stores rich objects: navigate to a few modules, check `localStorage.getItem("basicos:recent-routes")`
4. Verify `CommandPalette` still shows recents correctly after format change
