---
name: ui-review
description: >
  Visual UI design QA skill that opens the running application in a real browser and systematically
  reviews every page for design quality issues: hardcoded colors, dark mode failures, color contrast
  violations, layout bugs, typography inconsistencies, missing component states, spacing drift, and
  design system compliance. Uses the Electron CDP (agent-browser) or Playwright CLI framework to
  navigate every page, screenshot it, toggle dark mode, resize viewports, and produce a structured
  defect report with severity ratings and exact fixes.

  ALWAYS use this skill when the user asks to: review the UI, check the design, audit the UI,
  visual QA, design QA, check dark mode, check contrast, check colors, find UI bugs, review
  styling, check responsive, check layout, "does this look right", "review my UI", "check the
  design system", "find visual bugs", "UI audit", "design review", "check accessibility",
  "review dark mode", "review light mode", "check spacing", "review typography".
allowed-tools:
  - Bash(agent-browser:*)
  - Bash(playwright-cli:*)
  - Bash(curl:*)
  - Bash(ls:*)
  - Bash(find:*)
  - Bash(grep:*)
  - Bash(head:*)
  - Bash(tail:*)
  - Bash(wc:*)
  - Bash(mkdir:*)
  - Bash(cat:*)
  - Bash(open:*)
  - Bash(sleep:*)
  - Bash(pgrep:*)
  - Bash(kill:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Agent
user_invocable: true
---

# UI Design QA — Visual Review & Design System Compliance

You are a senior UI QA engineer who opens the running application in a real browser and
systematically reviews every visible surface for design quality issues. You don't guess — you
screenshot, measure, toggle themes, resize viewports, and document every defect with severity
and a concrete fix.

**Core insight:** AI-generated UIs break in predictable ways — hardcoded colors instead of
design tokens, broken dark mode, failing contrast ratios, missing component states, spacing
drift, layout overflow, and z-index chaos. This skill catches all of them systematically.

---

## TESTING MODE SELECTION

### Electron Mode (agent-browser + CDP)
Use when reviewing BasicsOS or any Electron app.

**Setup:**
```bash
# Start the app with CDP enabled (if not already running)
REMOTE_DEBUGGING_PORT=9222 pnpm run dev:all &
for i in $(seq 1 30); do
  curl -s http://localhost:9222/json > /dev/null 2>&1 && break
  sleep 2
done
```

**Bring window to front:**
```bash
open -a "/Users/akeilsmith/basicsOSnew/node_modules/.pnpm/electron@40.6.1/node_modules/electron/dist/Electron.app"
sleep 2
```

**Tab switching:** Voice Pill = tab 0, main app = tab 1. ALWAYS switch to tab 1 first:
```bash
agent-browser --cdp 9222 tab 1
```

### Web Mode (playwright-cli)
Use when reviewing a standard web app.

```bash
playwright-cli open http://localhost:5173 --headed
```

---

## COMMAND REFERENCE

### Electron (agent-browser)
```bash
agent-browser --cdp 9222 tab 1                     # Switch to main app
agent-browser --cdp 9222 snapshot -i                # Interactive snapshot with @refs
agent-browser --cdp 9222 screenshot                 # Visual screenshot
agent-browser --cdp 9222 click @e13                 # Click element by ref
agent-browser --cdp 9222 fill @e5 "text"            # Fill input
agent-browser --cdp 9222 type "text"                # Type into focused
agent-browser --cdp 9222 press Enter                # Press key
agent-browser --cdp 9222 press Escape               # Press Escape
agent-browser --cdp 9222 hover @e12                 # Hover element
agent-browser --cdp 9222 navigate "http://localhost:5173/objects/contacts"
agent-browser --cdp 9222 eval "document.title"
agent-browser --cdp 9222 eval "someJsExpression"
```

### Playwright (web)
```bash
playwright-cli open <url> --headed
playwright-cli snapshot
playwright-cli screenshot --filename=name
playwright-cli click <ref>
playwright-cli hover <ref>
playwright-cli fill <ref> "value"
playwright-cli press Tab
playwright-cli goto <url>
```

### Core Loop: snapshot -> observe -> screenshot -> document

**NEVER review blind.** Always snapshot + screenshot before documenting issues on any page.

---

## PHASE 0: SETUP & PAGE DISCOVERY

### 0a. Create output directory

```bash
mkdir -p ui-review/screenshots/light ui-review/screenshots/dark
```

### 0b. Discover all pages from codebase

Read the route config and build the page list:

```bash
grep -rn "path" src/App.tsx | head -40
find src/components/pages -name "*.tsx" | sort
```

Build a list of every navigable URL. For BasicsOS this includes:
- `/home` — Home page
- `/objects/contacts` — People list
- `/objects/companies` — Companies list
- `/objects/deals` — Deals list (table + kanban)
- `/objects/{slug}/{id}` — Record detail (need at least one record)
- `/chat` — Chat page
- `/tasks` — Tasks page
- `/notes` — Notes page
- `/automations` — Automations list
- `/settings` — Settings page
- `/profile` — Profile page
- `/import` — Import wizard
- Command palette (Cmd+K)
- Create record modals (per object)

### 0c. Authenticate

```bash
# Navigate to login if needed
agent-browser --cdp 9222 navigate "http://localhost:5173"
agent-browser --cdp 9222 snapshot -i
# Login: admin@example.com / admin123
```

### 0d. Get current theme state

```bash
agent-browser --cdp 9222 eval "document.documentElement.classList.toString()"
agent-browser --cdp 9222 eval "document.documentElement.style.colorScheme"
```

---

## PHASE 1: LIGHT MODE FULL REVIEW

For EVERY page in the page list, execute this review protocol.

### 1a. Per-page review protocol

For each page:

```bash
# 1. Navigate
agent-browser --cdp 9222 navigate "<url>"
sleep 1

# 2. Screenshot
agent-browser --cdp 9222 screenshot
# Save/note as: ui-review/screenshots/light/<page-name>.png

# 3. Snapshot for structure
agent-browser --cdp 9222 snapshot -i
```

Then evaluate against every checklist category below.

### 1b. Color & Token Compliance

Check for hardcoded colors vs design tokens. AI defaults to `bg-white`, `text-gray-500`,
`bg-zinc-100` instead of `bg-background`, `text-foreground`, `bg-muted`.

**What to look for in screenshots:**
- Text that appears too light or too dark for its context
- Backgrounds that don't match the app's color system
- Borders that are inconsistent shades
- Elements that visually "pop out" of the design system

**What to check in code (after visual issue found):**
```bash
# Find hardcoded colors in the component
grep -rn "bg-white\|bg-black\|bg-gray\|bg-zinc\|bg-slate\|text-gray\|text-zinc\|text-slate\|border-gray\|border-zinc" src/components/<component>.tsx
# These should be: bg-background, text-foreground, text-muted-foreground, border-border, bg-muted, bg-card, etc.
```

**Correct token mapping:**
| Hardcoded (BAD) | Token (GOOD) | Purpose |
|-----------------|-------------|---------|
| `bg-white` / `bg-zinc-950` | `bg-background` | Page background |
| `bg-gray-50` / `bg-zinc-900` | `bg-muted` | Muted sections |
| `bg-white` / `bg-zinc-800` | `bg-card` | Card backgrounds |
| `text-gray-900` / `text-white` | `text-foreground` | Primary text |
| `text-gray-500` | `text-muted-foreground` | Secondary text |
| `border-gray-200` | `border-border` | Borders |
| `border-gray-300` | `border-input` | Input borders |
| Literal hex values | CSS variables | Any color |

### 1c. Color Contrast (WCAG AA)

Check text contrast against its background. WCAG AA requires:
- **4.5:1** for normal text (under 18pt / 24px)
- **3:1** for large text (18pt+ / 24px+ or 14pt bold / 18.5px bold)
- **3:1** for non-text UI (icons, borders, focus rings)

**Common Tailwind failures:**

| Combination | Ratio | Verdict |
|-------------|-------|---------|
| `gray-400` on `white` | 2.9:1 | FAIL |
| `gray-500` on `gray-100` | 4.2:1 | FAIL for normal text |
| `red-500` on `red-50` | 4.0:1 | FAIL |
| `blue-400` on `white` | 2.7:1 | FAIL |

**What to look for in screenshots:**
- Placeholder text that's hard to read
- Muted text that disappears into its background
- Icons that blend into their container
- Disabled states that are indistinguishable from enabled
- Badge text that's hard to read against badge background
- Status indicators relying solely on color

**Check via JS evaluation:**
```bash
agent-browser --cdp 9222 eval "
  const el = document.querySelector('<selector>');
  const style = getComputedStyle(el);
  JSON.stringify({ color: style.color, bg: style.backgroundColor, fontSize: style.fontSize });
"
```

### 1d. Layout & Overflow

**What to look for:**
- Horizontal scrollbars on the page (indicates overflow)
- Text truncated without ellipsis
- Overlapping elements (z-index issues)
- Elements pushed off-screen
- Content hidden behind fixed headers or sidebars
- Flex children not wrapping (missing `flex-wrap`)
- Flex children not shrinking (missing `min-w-0`)
- Gaps between sidebar and content area
- Inconsistent padding/margins between similar sections

**Check for horizontal overflow:**
```bash
agent-browser --cdp 9222 eval "document.documentElement.scrollWidth > document.documentElement.clientWidth"
```

**Debug technique — red outline everything:**
```bash
agent-browser --cdp 9222 eval "document.querySelectorAll('*').forEach(el => el.style.outline = '1px solid red')"
agent-browser --cdp 9222 screenshot
# Then remove:
agent-browser --cdp 9222 eval "document.querySelectorAll('*').forEach(el => el.style.outline = '')"
```

### 1e. Typography & Spacing

**What to look for:**
- Inconsistent font sizes between similar elements
- Line height too tight (overlapping descenders/ascenders) or too loose
- Spacing that doesn't follow a scale (e.g., 13px instead of 12 or 16)
- Text wrapping awkwardly in narrow containers
- Headings that don't have consistent hierarchy (h1 > h2 > h3 sizes)
- Misaligned text baselines in adjacent elements

**Spacing scale for BasicsOS (Tailwind 4px base):**
Valid values: 0, 1 (4px), 1.5 (6px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px)

### 1f. Component States

Production components need these states. Check each interactive element:

| State | What to check |
|-------|--------------|
| **Default** | Does it render correctly at rest? |
| **Hover** | Hover the element — does it have visual feedback? Is it guarded with `@media (hover: hover)`? |
| **Focus** | Tab to the element — is there a visible focus ring? Is it >=2px with >=3:1 contrast? |
| **Active** | Click and hold — any pressed state? |
| **Disabled** | If applicable — is it visually distinct? Does it show `cursor: not-allowed`? |
| **Loading** | If applicable — spinner, skeleton, or shimmer? |
| **Error** | If applicable — red border, error message? |
| **Empty** | If applicable — helpful empty state message? |

**Check focus rings:**
```bash
# Tab through the page and screenshot
agent-browser --cdp 9222 press Tab
agent-browser --cdp 9222 press Tab
agent-browser --cdp 9222 press Tab
agent-browser --cdp 9222 screenshot
```

**Check hover states:**
```bash
agent-browser --cdp 9222 hover @<ref>
agent-browser --cdp 9222 screenshot
```

### 1g. Z-Index & Stacking

**What to look for:**
- Modals/dialogs that don't overlay the full page
- Dropdowns that render behind other elements
- Tooltips clipped by overflow:hidden containers
- Fixed headers covering content when scrolling
- Overlapping interactive elements (can't click the one you want)

**Check scroll-padding for sticky headers:**
```bash
agent-browser --cdp 9222 eval "getComputedStyle(document.documentElement).scrollPaddingTop"
```

---

## PHASE 2: DARK MODE REVIEW

### 2a. Toggle to dark mode

```bash
# Toggle via settings or class manipulation
agent-browser --cdp 9222 eval "document.documentElement.classList.add('dark')"
# Or navigate to settings and toggle theme
sleep 1
```

### 2b. Re-screenshot every page

For EVERY page, navigate and screenshot again:

```bash
agent-browser --cdp 9222 navigate "<url>"
sleep 1
agent-browser --cdp 9222 screenshot
# Save/note as: ui-review/screenshots/dark/<page-name>.png
```

### 2c. Dark mode specific checks

For each page, check:

| Issue | What to look for |
|-------|-----------------|
| **Invisible text** | Text that disappears against the dark background (hardcoded `text-gray-900` without `dark:` override) |
| **White flashes** | Elements with `bg-white` that didn't swap to dark |
| **Invisible borders** | `border-gray-200` borders that vanish on dark backgrounds |
| **Missing shadows** | `shadow-lg` using black alpha values invisible on dark |
| **Broken SVGs/icons** | Icons with hardcoded fill colors that don't adapt |
| **Input fields** | Inputs with white backgrounds or invisible placeholder text |
| **Badges/pills** | Color badges that lose readability on dark backgrounds |
| **Code blocks** | Code or pre elements with light backgrounds |

**Quick check for hardcoded bg-white:**
```bash
agent-browser --cdp 9222 eval "
  document.querySelectorAll('[class*=\"bg-white\"]').length
"
```

### 2d. Mid-session theme toggle

Toggle dark mode ON and OFF without refreshing. Check for:
- Flash of unstyled content (FOUC)
- Elements that don't transition smoothly
- State that gets lost on toggle

```bash
agent-browser --cdp 9222 eval "document.documentElement.classList.remove('dark')"
sleep 0.5
agent-browser --cdp 9222 screenshot
agent-browser --cdp 9222 eval "document.documentElement.classList.add('dark')"
sleep 0.5
agent-browser --cdp 9222 screenshot
```

---

## PHASE 3: RESPONSIVE / VIEWPORT REVIEW

### 3a. Test at key breakpoints

Resize the viewport and screenshot at each breakpoint:

```bash
# Mobile (375px)
agent-browser --cdp 9222 eval "
  window.resizeTo(375, 812);
  [window.innerWidth, window.innerHeight];
"
sleep 1
agent-browser --cdp 9222 screenshot

# Tablet (768px)
agent-browser --cdp 9222 eval "window.resizeTo(768, 1024)"
sleep 1
agent-browser --cdp 9222 screenshot

# Small desktop (1024px)
agent-browser --cdp 9222 eval "window.resizeTo(1024, 768)"
sleep 1
agent-browser --cdp 9222 screenshot

# Full desktop (1440px)
agent-browser --cdp 9222 eval "window.resizeTo(1440, 900)"
sleep 1
agent-browser --cdp 9222 screenshot
```

**Note:** In Electron, `window.resizeTo` may not work. Use CDP directly or evaluate at
current viewport size and note if the app is desktop-only.

### 3b. Responsive checks

| Issue | What to look for |
|-------|-----------------|
| **Horizontal overflow** | Content wider than viewport — horizontal scrollbar |
| **Overlapping elements** | Sidebar overlapping content, nav overlapping page |
| **Unreadable text** | Text too small at mobile size, no responsive font scaling |
| **Missing flex-wrap** | Row items that should wrap but overflow instead |
| **Touch targets** | Buttons/links smaller than 44x44px on mobile |
| **Hidden content** | Important content pushed off-screen by fixed elements |
| **Tables** | Wide tables that don't scroll or collapse on mobile |

---

## PHASE 4: INTERACTIVE ELEMENT REVIEW

### 4a. Modals & Dialogs

For every modal/dialog in the app:

```bash
# Open the modal
agent-browser --cdp 9222 click @<trigger-ref>
sleep 0.5
agent-browser --cdp 9222 screenshot
```

Check:
- [ ] Backdrop overlay covers full page
- [ ] Modal is centered
- [ ] Close via X button works
- [ ] Close via Escape works
- [ ] Close via backdrop click works
- [ ] Content doesn't overflow modal bounds
- [ ] Focus is trapped inside modal
- [ ] Scrollable content scrolls within modal, not the page behind

### 4b. Dropdowns & Popovers

```bash
agent-browser --cdp 9222 click @<dropdown-trigger>
sleep 0.3
agent-browser --cdp 9222 screenshot
```

Check:
- [ ] Dropdown appears in correct position (not clipped by overflow)
- [ ] Dropdown doesn't extend off-screen
- [ ] Items are readable and have hover states
- [ ] Selecting an item closes the dropdown
- [ ] Escape closes the dropdown

### 4c. Form Fields

```bash
# Click into each input
agent-browser --cdp 9222 click @<input-ref>
agent-browser --cdp 9222 screenshot
```

Check:
- [ ] Focus ring visible on the active input
- [ ] Placeholder text readable (sufficient contrast)
- [ ] Label associated with input
- [ ] Error states show red border + message
- [ ] Disabled fields visually distinct

### 4d. Tables & Data Grids

```bash
agent-browser --cdp 9222 navigate "<list-page-url>"
agent-browser --cdp 9222 screenshot
```

Check:
- [ ] Column headers visually distinct from data rows
- [ ] Alternating row colors or borders for readability (if used)
- [ ] Cell content doesn't overflow
- [ ] Long text truncated with ellipsis
- [ ] Selected row/cell has visible highlight
- [ ] Hover state on rows
- [ ] Sticky header stays visible when scrolling

---

## PHASE 5: DESIGN SYSTEM DRIFT DETECTION

### 5a. Check for raw HTML elements bypassing components

```bash
# Look for raw <button> instead of <Button> component
grep -rn "<button" src/components/pages/ src/components/record-detail/ src/components/object-list/ | grep -v "ui/" | grep -v ".test."

# Look for raw <input> instead of <Input> component
grep -rn "<input" src/components/pages/ src/components/record-detail/ src/components/object-list/ | grep -v "ui/" | grep -v ".test."

# Look for raw <select>
grep -rn "<select" src/components/pages/ src/components/record-detail/ src/components/object-list/ | grep -v "ui/" | grep -v ".test."
```

### 5b. Check for hardcoded colors in component files

```bash
# Find hardcoded hex values
grep -rn "#[0-9a-fA-F]\{3,8\}" src/components/ --include="*.tsx" | grep -v "ui/" | grep -v node_modules | grep -v ".test." | head -30

# Find hardcoded Tailwind grays that should be tokens
grep -rn "bg-white\|bg-black\|bg-gray-\|bg-zinc-\|bg-slate-\|text-gray-\|text-zinc-\|text-slate-\|border-gray-\|border-zinc-\|border-slate-" src/components/ --include="*.tsx" | grep -v "ui/" | grep -v node_modules | head -30

# Find inline styles
grep -rn "style={{" src/components/ --include="*.tsx" | grep -v "ui/" | grep -v node_modules | head -20
```

### 5c. Check for inconsistent spacing

```bash
# Find pixel values that aren't on the 4px scale
grep -rn "p-[0-9]\|m-[0-9]\|gap-[0-9]\|px-\[.*px\]\|py-\[.*px\]\|p-\[.*px\]\|m-\[.*px\]" src/components/ --include="*.tsx" | grep -v "ui/" | grep -v node_modules | head -20
```

---

## PHASE 6: GENERATE REPORT

Combine all findings into `ui-review/REPORT.md`:

```markdown
# UI Design QA Report
**Date:** [date]
**App:** BasicsOS
**Testing Mode:** Electron CDP / Playwright Web
**Reviewer:** Claude (ui-review skill)

## Executive Summary
- **Pages reviewed:** X
- **Issues found:** X
- **Critical:** X | **High:** X | **Medium:** X | **Low:** X | **Cosmetic:** X

## Severity Definitions
- **Critical:** Unusable — text invisible, layout completely broken, interactive element blocked
- **High:** Major usability issue — wrong colors in dark mode, failing contrast on primary text, broken responsive layout
- **Medium:** Noticeable quality issue — inconsistent spacing, missing hover states, minor overflow
- **Low:** Minor polish — slight alignment off, cosmetic inconsistency
- **Cosmetic:** Nitpick — could be better but doesn't hurt usability

## Issues by Page

### [Page Name] — /path
**Light mode:** [screenshot path]
**Dark mode:** [screenshot path]

#### ISSUE-001: [Short description]
**Severity:** Critical / High / Medium / Low / Cosmetic
**Category:** Color Token / Contrast / Dark Mode / Layout / Typography / Spacing / Component State / Z-Index / Responsive / Design Drift
**Location:** [Component or area on screen]
**What's wrong:** [Specific observation]
**Expected:** [What it should look like]
**Fix:**
```
[Exact code change — file path, old value, new value]
```

---

### [Next Page]
[Same structure...]

---

## Design System Drift Summary

### Hardcoded Colors Found
| File | Line | Value | Should Be |
|------|------|-------|-----------|
| src/components/foo.tsx | 42 | bg-white | bg-background |
| ... | ... | ... | ... |

### Raw HTML Elements (Should Use Components)
| File | Line | Element | Should Be |
|------|------|---------|-----------|
| ... | ... | <button> | <Button> |

### Off-Scale Spacing
| File | Line | Value | Nearest Valid |
|------|------|-------|---------------|
| ... | ... | p-[13px] | p-3 (12px) |

## Recommendations (Priority Order)
1. [Highest impact fix]
2. [Next fix]
3. ...

## Pages Reviewed
| Page | URL | Light | Dark | Responsive | Issues |
|------|-----|-------|------|------------|--------|
| Home | /home | OK | 2 issues | OK | 2 |
| People | /objects/contacts | OK | 1 issue | OK | 1 |
| ... | ... | ... | ... | ... | ... |
```

---

## BEHAVIORAL RULES

1. **Always screenshot before judging.** Never claim a page "looks fine" without actually
   seeing it. The screenshot is your evidence.

2. **Follow snapshot -> screenshot -> document for every page.** No exceptions. The loop is:
   navigate, wait, snapshot (structure), screenshot (visual), evaluate, document.

3. **Review BOTH light and dark mode.** Every page gets reviewed in both themes. Dark mode
   issues are the most common AI-generated defects.

4. **Be specific in fixes.** Every issue needs: what file, what class/value is wrong, what it
   should be. "Fix the contrast" is useless. "`text-gray-400` on `bg-white` (2.9:1) — change
   to `text-gray-600` (5.7:1)" is actionable.

5. **Use the correct severity.** Critical means the UI is unusable (invisible text, blocked
   interactions). Don't inflate — cosmetic issues are cosmetic, not high severity.

6. **Check contrast with actual computed values, not guesses.** Use JS eval to get the real
   `color` and `backgroundColor` when you suspect a contrast issue.

7. **Don't just find problems — provide the fix.** Every issue should have a concrete code
   change. Reference the design token table in section 1b for color fixes.

8. **Check interactive elements by interacting with them.** Hover buttons, tab through forms,
   open dropdowns, trigger modals. Static screenshots miss state-dependent bugs.

9. **Run the design drift checks (Phase 5) on code, not just visuals.** Grep for hardcoded
   values even on pages that look fine — they may only break in dark mode or at different
   viewports.

10. **Create the output directory at the start.** All screenshots and the report go to
    `ui-review/`.
    ```bash
    mkdir -p ui-review/screenshots/light ui-review/screenshots/dark
    ```
