# UI Gap Analysis — Reference (Luxury Presence–style Contacts)

Comparison of our object list / table UI to the reference image, and what to change.

---

## 1. Screen fill and layout

| Reference | Ours | Gap |
|-----------|------|-----|
| Main content fills viewport; table has fixed header, only body scrolls | Page or whole table scrolls; table doesn’t claim remaining height | Table container doesn’t use flex chain (`flex-1` + `min-h-0`) so the scroll area has no fixed height |
| Clear “card” for the table (rounded, subtle shadow) | Table in a bordered, rounded box | We have border + rounded; could add a light shadow for depth |

**Fix:** Give the list page a proper flex chain so the table wrapper gets a height, and make the DataTable’s scroll container `flex-1 min-h-0`. Only the table body scrolls; header and pagination stay visible.

---

## 2. Table appearance

| Reference | Ours | Gap |
|-----------|------|-----|
| Light grey header row | `bg-background` (same as body) | Header doesn’t read as a distinct “strip” |
| Minimal row borders (light separators) | `border-b border-border/50` | Fine; could be even subtler |
| Comfortable row height | `--row-height: 36px` | Slightly tighter; 40px is closer to reference |
| Clean sans-serif, good cell padding | `text-[13px]`, `px-3` | Good; keep |

**Fix:** Use `bg-muted/40` (or similar) on the table header. Optionally bump `--row-height` to 40px for list tables.

---

## 3. Top bar and actions

| Reference | Ours | Gap |
|-----------|------|-----|
| Single clear row: title + “Actions” + “New contact” | Icon row, then view tabs, then Sort/Filter/Columns | We have more rows; reference is one compact bar |
| Search bar prominent, full-width feel | Search lives in DataTableToolbar (filters) | Different information architecture; OK to keep but could add a dedicated search in the bar later |

No change in this pass; we already reduced duplication (one New, one count).

---

## 4. Pagination and count

| Reference | Ours | Gap |
|-----------|------|-----|
| “23 records” left, “< 1/3 >” right | “8 companies” + “Page 1 of 1” + controls | Same idea; we’re aligned after removing duplicate count |

No change.

---

## 5. Optional (later)

- **Name column:** Reference uses avatar + name; we use Cell renderers. Avatar in primary column would be a field-type or column config change.
- **Badges/pills:** Score and tags as colored pills are data/field-type specific; not a layout gap.
- **Sidebar counts:** Reference shows “All (25)” etc.; we could add counts to nav items in the app sidebar separately.

---

## Summary of changes to implement

1. **Layout:** ObjectListPage: table wrapper `flex-1 min-h-0 flex-col` (no `overflow-auto`). DataTable: root `flex-1 min-h-0 flex-col`, scroll div `flex-1 min-h-0 overflow-auto` so the table fills the viewport and only the body scrolls.
2. **Table look:** Header `bg-muted/40`; optional `--row-height: 40px` for list tables; optional shadow on table container.
3. **Whitespace:** Already reasonable (layout `px-4`, page `pt-4`); no change unless we tighten the top bar later.
