# Automation Builder UX Implementation Plan

**Goal:** Simplify the automation builder by consolidating redundant entry points, moving Connections into automations, and aligning with n8n/Zapier patterns. Reduce confusion between "Add node", "Node palette", and "Properties panel".

**Reference:** n8n uses a single right-side nodes panel (Tab or + to open); Zapier uses a sidebar for step details. Both have one clear way to add steps and configure them.

---

## 0. Summary of Changes

| Phase | Scope | Effort |
|-------|-------|--------|
| **1** | Consolidate add-node: remove header dropdown, keep palette as sole entry | Small |
| **2** | Simplify header: remove Palette toggle, always show palette | Small |
| **3** | Right panel: add empty state when no node selected | Small |
| **4** | Move Connections into automations (palette tab or sub-route) | Medium |
| **5** | (Optional) Canvas + button to open palette | Small |

---

## 1. Current State

### 1.1 Layout

- **Left:** Node palette (collapsible rail: Triggers + Actions). Toggled via header "Palette" button.
- **Center:** Canvas (React Flow).
- **Right:** Properties panel (appears when a node is selected; collapsible).
- **Header:** Back, Name, **Palette toggle**, **Add node dropdown**, Run now, History, Active, Save.

### 1.2 Redundancy

- **Add node dropdown** (header) duplicates the node palette.
- **Palette toggle** hides the palette; "Add node" still works when hidden.
- Three separate surfaces: Add node, Palette, Properties.

### 1.3 Connections

- Standalone **Connections** app at `/connections` (under Apps in sidebar).
- Used primarily by automations (Gmail, Slack).
- Disconnected from the builder context.

### 1.4 Key Files

| File | Purpose |
|------|---------|
| `packages/automations/src/AutomationBuilderPage.tsx` | Builder UI, header, palette, properties, canvas |
| `packages/automations/src/NodePaletteRail.tsx` | Left palette: Triggers + Actions |
| `src/components/pages/ConnectionsPage.tsx` | Connections management page |
| `src/config/sidebar-nav.ts` | Sidebar config: `SIDEBAR_NAV_APPS`, `SIDEBAR_NAV_AUTOMATIONS` |
| `packages/hub/src/routes.ts` | `ROUTES.CONNECTIONS`, `ROUTES.AUTOMATIONS` |
| `src/App.tsx` | Route for `/connections` |

---

## 2. Target Structure (After Implementation)

### 2.1 Layout

| Area | Purpose |
|------|---------|
| **Left** | Node palette (always visible, collapsible). Tabs: **Nodes** \| **Connections** |
| **Center** | Canvas. Floating + button opens/focuses palette (optional) |
| **Right** | Properties when node selected; empty state when none |
| **Header** | Back, Name, Run, History, Active, Save. No Palette toggle, no Add node |

### 2.2 Single Entry Point

- Add nodes **only** via the node palette (left).
- No header "Add node" dropdown.
- Palette always shown (no toggle); collapsed by default if desired.

### 2.3 Connections in Automations

- **Option A (recommended):** Tabs in left palette: `Nodes` \| `Connections`.
- **Option B:** Connections as sub-route: `/automations/connections`; link from palette footer.
- **Option C:** Connections section at bottom of palette with "Manage" link.

Remove Connections from top-level Apps in sidebar.

---

## 3. Phase-by-Phase Implementation

### Phase 1: Consolidate Add-Node Entry Point

**Goal:** One way to add nodes — the palette.

**Tasks:**

1. **Remove Add node dropdown from header** in `AutomationBuilderPage.tsx`.
   - Delete the `DropdownMenu` block (lines ~337–363) that contains "Add node".
   - Keep `handleAddNode` for palette use.

2. **Verify palette covers all node types** — it already has TRIGGER_ITEMS and ACTION_ITEMS. No changes needed.

**Files:** `packages/automations/src/AutomationBuilderPage.tsx`

**Risks:** None. Palette already provides same functionality.

---

### Phase 2: Simplify Header — Remove Palette Toggle

**Goal:** Palette is always visible; no toggle in header.

**Tasks:**

1. **Remove Palette button** from header in `AutomationBuilderPage.tsx`.
   - Delete the Button with `SquaresFourIcon` and `onClick={() => setPaletteVisible((v) => !v)}`.

2. **Remove `paletteVisible` state** or set it always `true`.
   - Simplify: remove `paletteVisible` and `setPaletteVisible`; always render the palette.
   - Remove `localStorage` reads/writes for `automation-palette-visible`.

3. **Remove palette conditional** — always render the palette overlay (remove `{paletteVisible && (...)}`).

**Files:** `packages/automations/src/AutomationBuilderPage.tsx`

**Risks:** None. Reduces header clutter.

---

### Phase 3: Right Panel Empty State

**Goal:** When no node is selected, show a helpful message instead of hiding the panel.

**Tasks:**

1. **Optional: Always show right panel** with two states:
   - **No selection:** Message: "Select a node to configure" or "Add a node from the palette and click it to configure."
   - **Node selected:** Current ConfigPanel content.

   **Alternative:** Keep current behavior (panel only when node selected). This phase is optional for polish.

2. If implemented: Add a narrow right rail (e.g. 48px) when nothing selected, with "Select a node" text. Or keep panel hidden when nothing selected — both are valid.

**Recommendation:** Keep current behavior (panel only when node selected). Skip this phase unless UX testing suggests otherwise.

---

### Phase 4: Move Connections into Automations

**Goal:** Connections accessible from within the automation builder context.

#### 4.1 Option A: Tabs in Node Palette (Recommended)

**Tasks:**

1. **Add tab state to NodePaletteRail** (or new wrapper):
   - Tabs: `Nodes` | `Connections`.
   - `Nodes` tab: current Triggers + Actions content.
   - `Connections` tab: embed `ConnectionsPage` content or a simplified inline view (provider cards, connect/disconnect).

2. **Create `ConnectionsTab` component** (or reuse ConnectionsPage logic):
   - Extract connect/disconnect logic from `ConnectionsPage.tsx` into a reusable component.
   - Use in both standalone page (during migration) and in palette tab.

3. **Routing:** Connections can remain at `/connections` for direct links (e.g. OAuth callback), but primary access is from builder palette.

#### 4.2 Option B: Sub-route under Automations

**Tasks:**

1. **Add route** `/automations/connections` in `AutomationsApp.tsx`:
   ```tsx
   { path: "connections", element: <ConnectionsPage /> }
   ```

2. **Add sidebar item** under Automations: "Connections" → `/automations/connections`.

3. **Remove Connections from Apps** in `SIDEBAR_NAV_APPS` in `src/config/sidebar-nav.ts`.

4. **Redirect** `/connections` → `/automations/connections` (for backward compatibility).

#### 4.3 Option C: Link in Palette Footer

**Tasks:**

1. **Add footer to NodePaletteRail**: "Manage connections" link → `/automations/connections` or opens connections in a sheet/dialog.
2. Implement Option B for the route, then add the link.

**Recommended approach:** Option A (tabs) for in-context access; keep `/connections` and add redirect to `/automations/connections` if we use Option B. Or: Option A only — tabs in palette, remove Connections from Apps, add `/automations/connections` as sub-route for deep linking.

**Files:**
- `packages/automations/src/NodePaletteRail.tsx` (or new `AutomationPalette.tsx`)
- `packages/automations/src/AutomationsApp.tsx`
- `src/config/sidebar-nav.ts`
- `src/App.tsx` (redirect)
- `src/components/pages/ConnectionsPage.tsx` (extract reusable logic if needed)

---

### Phase 5: (Optional) Canvas + Button

**Goal:** n8n-style: click + on canvas to open palette.

**Tasks:**

1. **Add a floating + button** on the canvas (e.g. top-left or near center when empty).
2. **On click:** Expand the palette if collapsed; optionally focus/scroll to node list.
3. **Implementation:** Use React Flow `Panel` or absolute-positioned div. Button calls `onExpandedChange(true)` and possibly `setPaletteVisible(true)` if we kept that.

**Files:** `packages/automations/src/AutomationBuilderPage.tsx`, possibly `NodePaletteRail` (expose expand callback).

**Note:** Since we removed the palette toggle, the palette is always visible. The + could just expand the palette when collapsed. Low priority.

---

## 4. Sidebar and Route Changes

### 4.1 Remove Connections from Apps

**File:** `src/config/sidebar-nav.ts`

**Before:**
```ts
items: [
  { title: "CRM", path: ROUTES.CRM, icon: SquaresFourIcon },
  // ...
  { title: "Connections", path: ROUTES.CONNECTIONS, icon: LinkIcon },
],
```

**After:** Remove the Connections item from `SIDEBAR_NAV_APPS`.

### 4.2 Add Connections under Automations

**File:** `src/config/sidebar-nav.ts`

**Option:** Add to `SIDEBAR_NAV_AUTOMATIONS`:
```ts
items: [
  { title: "All", path: ROUTES.AUTOMATIONS, icon: LightningIcon },
  { title: "Builder", path: `${ROUTES.AUTOMATIONS}/create`, icon: PlusIcon },
  { title: "Connections", path: ROUTES.AUTOMATIONS_CONNECTIONS, icon: LinkIcon },
  { title: "Runs", path: ROUTES.AUTOMATIONS_RUNS, icon: PlayIcon },
  { title: "Logs", path: ROUTES.AUTOMATIONS_LOGS, icon: FileTextIcon },
],
```

**Routes:** Add `AUTOMATIONS_CONNECTIONS: "/automations/connections"` in `packages/hub/src/routes.ts`.

### 4.3 Redirect Old Connections URL

**File:** `src/App.tsx`

Add redirect: `/connections` → `/automations/connections` for backward compatibility.

---

## 5. Dependencies and Order

```
Phase 1 (Add node) ─────────────────────────────────────────────────┐
                                                                    │
Phase 2 (Palette toggle) ────────────────────────────────────────────┤── Can run in parallel
                                                                    │
Phase 3 (Right panel empty state) ──────────────────────────────────┘
                                                                    │
Phase 4 (Connections) ──────────────────────────────────────────────┐
  - 4.1 Add tabs to palette                                          │
  - 4.2 Add /automations/connections route                           │── Depends on 4.2 for route
  - 4.3 Sidebar + redirect                                            │
                                                                    │
Phase 5 (Canvas +) ──────────────────────────────────────────────────┘── Optional, last
```

---

## 6. Implemented (March 2025)

- [x] **Floating + button** on canvas (top-left), opens searchable node picker
- [x] **Node picker sheet** with search, triggers + actions, connection-aware
- [x] **Connection-aware palette** — Slack/Gmail show "Connect" when disconnected; clicking opens Connections
- [x] **Connection status on nodes** — Slack/Gmail nodes show warning badge when disconnected
- [x] **Connection banner in Properties** — Slack/Gmail config panels show "Connect" when disconnected
- [x] **Simplified empty state** — "Click + to add your first step"
- [x] Add node via palette or floating +

## 7. Testing Checklist

- [ ] Add node via floating + opens picker.
- [ ] Add node via palette works.
- [ ] Search in node picker filters triggers/actions.
- [ ] Slack/Gmail items show "Connect" when provider not connected.
- [ ] Clicking connection-required item opens Connections page.
- [ ] Slack/Gmail nodes on canvas show warning badge when disconnected.
- [ ] Properties panel shows connection banner for Slack/Gmail when disconnected.

---

## 7. Rollback

- Phase 1–2: Revert `AutomationBuilderPage.tsx` to restore Add node dropdown and Palette toggle.
- Phase 4: Restore Connections in Apps; remove from Automations; remove redirect.
- Keep `/connections` route active during migration for OAuth and bookmarks.
