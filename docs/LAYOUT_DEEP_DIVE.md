# Layout deep dive

This document describes how the app shell (sidebar + main content), headers, and list/table scrolling are implemented, and how they were fixed to respect the sidebar and contain table overflow.

## 1. App shell: sidebar + main content

### Where it lives

- **Shell**: `packages/hub/src/HubLayout.tsx` — wraps all protected routes.
- **Sidebar**: `packages/hub/src/HubSidebar.tsx` uses `src/components/ui/sidebar.tsx` (Shadcn-style sidebar).

### How the sidebar works (`src/components/ui/sidebar.tsx`)

- **SidebarProvider**: Wraps the app in a flex container (`flex min-h-svh w-full`) and sets CSS variables:
  - `--sidebar-width`: 16rem (expanded)
  - `--sidebar-width-icon`: 3rem (collapsed)
- **Sidebar** (desktop): Renders a **peer** div with two children:
  1. **sidebar-gap** (`data-slot="sidebar-gap"`): In-flow div that reserves horizontal space. Width is `--sidebar-width` when expanded, `--sidebar-width-icon` when collapsed (icon mode). This is what pushes the main content to the right.
  2. **sidebar-container**: `position: fixed; inset-y-0; left-0` (or right), so the actual sidebar is out of flow and overlays nothing if the gap is correct.

So the layout is: `[Sidebar peer div (gap + fixed sidebar)][main]`. The main content is the second flex child and should start to the right of the gap.

### Previous issue: main not using the layout primitive

- **HubLayout** used a raw `<main>` with manual width via `peer-data-[state=...]`:
  - `peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]`
  - `peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)]`
- Problems:
  - The main did not use **SidebarInset**, the intended content area in the sidebar design (flex-1, correct flex behavior).
  - No `min-w-0`, so wide content (e.g. wide tables) could force the main to grow and overlap or push layout.
  - Headers/content could appear to “go over” the sidebar if the main ever took full width or overflowed.

### Fix

- Use **SidebarInset** for the main content so it is the canonical “content next to sidebar” block (`flex-1`, `min-w-0` via class if needed).
- Keep the scroll and inner content (e.g. `#main-content`) inside SidebarInset so all content, including headers, stays to the right of the sidebar.

---

## 2. Headers “going over” the sidebar

- **Page headers** (e.g. “Companies”, “Deals”) live inside the main content area (e.g. `ObjectListPage` → inside HubLayout’s main).
- If the main content area is not constrained to “content only” (i.e. to the right of the sidebar), then headers can visually sit under or past the sidebar.
- **Cause**: Main was not using SidebarInset and had no `min-w-0`, so width/overflow behavior was brittle.
- **Fix**: Use SidebarInset and ensure the main content wrapper has `min-w-0` and correct flex so it never overlaps the sidebar gap.

---

## 3. Table/list scroll (company, deal, people tables)

### Current structure (before fix)

- **HubLayout**: `main` → `div.flex-1.overflow-auto` → `div#main-content.max-w-screen-xl...` → page content.
- **ObjectListPage**: `div.flex.flex-col.gap-3.h-full` → page header, view selector, toolbar, **DataTable**, modals.
- **DataTable** (`src/components/data-table/DataTable.tsx`): Wraps the table in a `div` with `overflow-auto` and no max height. The table has `width: max-content; minWidth: 100%`.

So:

- The **scroll container** was the HubLayout’s `flex-1 overflow-auto` div.
- The whole page (header + toolbar + table) scrolled together. With many columns, the **entire page** scrolled horizontally, which looks odd.
- The table header (`TableHeader` in `src/components/ui/table.tsx`) is `sticky top-0`; it sticks within the nearest scroll container (the HubLayout content area), which is correct for vertical scroll, but the “whole page scrolls” feeling and horizontal page scroll were the issues.

### Desired behavior

- **Vertical**: Only the **table body** scrolls; the page header, view selector, and toolbar stay fixed. The table header stays sticky at the top of the **table** scroll container.
- **Horizontal**: Only the **table** area scrolls horizontally; the rest of the page (sidebar, page title, toolbar) does not move.

### Fix

- Give the **list page** a constrained layout:
  - Outer: `flex flex-col h-full` (or equivalent) so the page has a defined height.
  - Top: page header, view selector, toolbar (non-scrolling).
  - Middle: a **table wrapper** with `flex-1 min-h-0 overflow-auto` so it takes remaining height and is the only scroll container for the table.
- Keep the DataTable’s scroll div as the scroll container for the table (overflow-auto), and ensure it lives inside that middle wrapper so:
  - Vertical scroll is only inside the table area; sticky thead sticks to the top of that div.
  - Horizontal scroll is only inside the table area; the page does not scroll horizontally.

---

## 4. Summary of layout flow (after fixes)

```
SidebarProvider (flex min-h-svh w-full, --sidebar-width vars)
├── Sidebar (peer: gap + fixed sidebar)
│   ├── sidebar-gap (width 16rem / 3rem)
│   └── sidebar-container (fixed)
└── SidebarInset (main, flex-1 min-w-0 flex flex-col)
    └── div.flex-1.overflow-auto
        └── div#main-content.max-w-screen-xl...
            └── Page (e.g. ObjectListPage)
                ├── Page header (fixed in flow)
                ├── View selector / toolbar (fixed in flow)
                └── Table wrapper (flex-1 min-h-0 overflow-auto)  ← only this scrolls
                    └── DataTable (overflow-auto, sticky thead)
```

- **Sidebar**: Reserve space with gap; fixed sidebar overlays that gap only.
- **Main**: SidebarInset so headers and content never “go over” the sidebar.
- **Tables**: One scroll container for the table only; no full-page scroll for table overflow.
