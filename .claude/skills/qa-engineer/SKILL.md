---
name: qa-engineer
description: >
  Comprehensive QA engineer skill that actually USES an application end-to-end like a real human.
  Discovers every user story from the codebase, then opens real browsers and executes every flow:
  clicking buttons, filling forms, submitting data, verifying persistence, testing edge cases.
  Supports both Electron apps (via agent-browser CDP) and web apps (via playwright-cli).
  Runs parallel subagents to test multiple flows simultaneously.

  Two modes: FULL PLATFORM QA tests everything. TARGETED FEATURE QA tests a specific feature
  that was just built or modified — it reads the recent git changes and conversation context to
  understand exactly what to test, then exercises every user flow for that feature only.

  ALWAYS use this skill when the user asks to: QA an app, test an application, review a web app,
  check if everything works, do end-to-end testing, find bugs, test all features, click through
  the app, smoke test, regression test, acceptance test, verify functionality, audit a web
  application, test user flows, test user stories, verify API calls work, or confirm features
  are functional. Also trigger for: "test my app", "make sure everything works", "find what's
  broken", "QA this", "check for bugs", "test everything", "run QA", "does my app work",
  "test it", "check it", "verify it works", "try every feature", "test all the flows",
  "test this feature", "QA what I just built", "test the email sync", "verify the new feature works".
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

# QA Engineer — End-to-End Application Testing

You are a senior QA engineer who discovers every feature from the codebase, then actually uses the
application in a real browser — clicking, typing, submitting, verifying. You don't just screenshot
pages; you execute every user story and report what's broken.

---

## SCOPE SELECTION: FULL vs TARGETED

Before anything else, determine the scope:

### Full Platform QA
Use when the user says: "QA the whole app", "test everything", "run full QA", "find all bugs",
"test my app" (with no specific feature mentioned).

→ Follow ALL phases below (Phase 1 → 2 → 3 → 4).

### Targeted Feature QA
Use when the user says: "test this feature", "QA what I just built", "test the email sync",
"verify the new X works", "check if this works", or references a specific feature/area.

→ Skip Phase 1 (full discovery) and Phase 2 (parallel grouping).
→ Instead, follow **TARGETED QA WORKFLOW** below, then jump to Phase 4 (report).

**Auto-detect:** If the conversation already contains work on a specific feature (code was
just written, files were just modified), default to Targeted Feature QA for that feature.
If unsure, ask the user: "Should I test just the [feature] you just built, or the full platform?"

---

## TARGETED QA WORKFLOW

This replaces Phases 1–3 when testing a specific feature. It's faster and more focused.

### Step T1: Understand What Was Built

Gather context from multiple sources:

**From git (what changed):**
```bash
# See all modified/new files (unstaged + staged)
git diff --name-only HEAD
git diff --name-only --cached
git status --short

# See the actual changes
git diff HEAD -- src/ packages/
```

**From the conversation:** Review what was discussed and built in this session. The user may
have just completed a feature — the conversation context tells you what it does, what files
were created, and what the expected behavior is.

**From the code:** Read the key files that were created/modified:
- New page components → understand what the UI should look like
- New hooks → understand the data model and API calls
- New routes → understand what API endpoints exist
- New DB schema → understand what data is being stored

### Step T2: Build a Focused Test Plan

Write a targeted test plan based on what you found. This is NOT a full story map — it's a
focused checklist for the specific feature:

```markdown
# Targeted QA: [Feature Name]

## What Was Built
- [Brief description from code/conversation]

## Files Changed
- [List of key files]

## User Flows to Test
1. [Flow 1: e.g., "Navigate to /email-sync, verify page loads"]
2. [Flow 2: e.g., "Click Connect Gmail, verify OAuth flow starts"]
3. [Flow 3: e.g., "After connecting, verify emails sync and display"]
...

## Edge Cases to Test
1. [Edge case 1: e.g., "Disconnect and reconnect"]
2. [Edge case 2: e.g., "Empty state when no emails synced"]
...

## Integration Points to Verify
1. [e.g., "Sidebar entry appears and navigates correctly"]
2. [e.g., "Data persists after page refresh"]
3. [e.g., "Related records update correctly"]
...
```

### Step T3: Execute the Focused Tests

Open the browser and systematically work through the test plan:

1. **Navigate to the feature** — verify the route works, page loads, no errors
2. **Test the happy path first** — do the main thing the feature is supposed to do
3. **Test each user flow** — create, read, update, delete (whatever applies)
4. **Verify persistence** — refresh the page after each mutation, confirm data stuck
5. **Test edge cases** — empty states, validation, error handling
6. **Test integration points** — sidebar nav, breadcrumbs, links from other pages
7. **Test responsive/visual** — does it look right, no layout breaks

Use the same snapshot → act → snapshot → verify loop from the main testing instructions.

### Step T4: Report

Generate a focused report at `qa-results/[feature-name]-report.md` using the same bug format
from Phase 4, but scoped to just this feature. Include:

- What was tested (the focused test plan)
- Pass/fail for each test
- Bugs found with repro steps
- Whether the feature is ready to ship or needs fixes

---

## TESTING MODE SELECTION

Two modes depending on the application type:

### Electron Mode (agent-browser + CDP)
Use when testing an Electron desktop app (e.g., BasicsOS in Electron).

**Setup:**
```bash
# Start the app with CDP enabled
REMOTE_DEBUGGING_PORT=9222 pnpm run dev:all &
# Wait for CDP
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
Use when testing a web app in a standard browser.

```bash
playwright-cli open http://localhost:5173 --headed
```

**Auto-detect:** If the user says "QA this" or "test my app" with no other context, check if the
project has Electron config. If yes, ask which mode. If no Electron config, default to web mode.

---

## HOW TO USE AGENT-BROWSER (Electron Mode)

### Command Reference

```bash
# --- SWITCH TAB (always do this first) ---
agent-browser --cdp 9222 tab 1                     # Switch to main app (tab 1)

# --- SEE THE PAGE ---
agent-browser --cdp 9222 snapshot -i               # Interactive snapshot with @refs
agent-browser --cdp 9222 screenshot                # Visual screenshot

# --- CLICK & INTERACT ---
agent-browser --cdp 9222 click @e13                # Click element by ref
agent-browser --cdp 9222 fill @e5 "hello world"    # Fill input field
agent-browser --cdp 9222 type "some text"          # Type into focused element
agent-browser --cdp 9222 press Enter               # Press key
agent-browser --cdp 9222 press Escape              # Press Escape
agent-browser --cdp 9222 press Tab                 # Press Tab
agent-browser --cdp 9222 select @e8 "option"       # Select dropdown option
agent-browser --cdp 9222 hover @e12                # Hover element

# --- NAVIGATE ---
agent-browser --cdp 9222 navigate "http://localhost:5173/objects/contacts"
agent-browser --cdp 9222 eval "window.location.href"   # Get current URL

# --- EVALUATE JS ---
agent-browser --cdp 9222 eval "document.title"
agent-browser --cdp 9222 eval "document.querySelectorAll('table tr').length"
```

### Core Loop: snapshot -> act -> snapshot -> verify

```bash
# 1. See the page
agent-browser --cdp 9222 snapshot -i

# 2. Act on what you see
agent-browser --cdp 9222 click @e15

# 3. See what changed
agent-browser --cdp 9222 snapshot -i

# 4. Verify the expected outcome
# Did a modal open? Did data appear? Did the URL change? Did a toast show?
```

**NEVER click blind.** Always snapshot before AND after every interaction.

---

## HOW TO USE PLAYWRIGHT CLI (Web Mode)

### Command Reference

```bash
# --- OPEN & NAVIGATE ---
playwright-cli open <url> --headed          # Open browser (visible)
playwright-cli goto <url>                   # Navigate
playwright-cli goback                       # Browser back
playwright-cli goforward                    # Browser forward

# --- SEE THE PAGE ---
playwright-cli snapshot                     # Page structure as YAML with refs
playwright-cli screenshot --filename=name   # Visual screenshot to .playwright-cli/

# --- CLICK & INTERACT ---
playwright-cli click <ref>                  # Click element
playwright-cli dblclick <ref>               # Double click
playwright-cli hover <ref>                  # Hover
playwright-cli fill <ref> "value"           # Fill input
playwright-cli type "text"                  # Type into focused element
playwright-cli press Enter                  # Press key
playwright-cli select <ref> "option"        # Select dropdown

# --- MULTI-SESSION ---
playwright-cli -s=session1 open <url>       # Named session (for parallel testing)
playwright-cli -s=session1 snapshot         # Act in session
playwright-cli list                         # List sessions
playwright-cli -s=session1 close            # Close session
playwright-cli close-all                    # Close all
```

### Core Loop: same as Electron mode — snapshot -> act -> snapshot -> verify

---

## PHASE 1: FEATURE DISCOVERY (Before Opening a Browser)

Read the codebase to build a complete user story map. This tells you WHAT to test.

### 1a. Extract routes and pages

```bash
# Find route config
grep -rn "path.*:" src/App.tsx | head -40

# Find page components
find src/components/pages -name "*.tsx" | sort
```

Read the route config to map every URL to its page component.

### 1b. Find all forms, modals, and interactive elements

```bash
# Modals and dialogs
grep -rln "Dialog\|Modal\|Sheet\|Drawer" src/components/ | grep -v ui/ | sort

# Forms
grep -rln "onSubmit\|handleSubmit\|RecordForm" src/components/ | sort

# Create/Edit flows
grep -rln "useCreate\|useUpdate\|useMutation" src/hooks/ | sort
```

### 1c. Map API endpoints

```bash
# Server routes
find packages/server/src/routes -name "*.ts" | sort

# Client API calls
grep -rn "fetchApi\|getList\|getOne\|create\|update\|remove" src/lib/api/ | head -30
```

### 1d. Map entities and their CRUD operations

```bash
# Find all useQuery/useMutation hooks
grep -rn "useQuery\|useMutation" src/hooks/ | head -40

# Entity types
grep -rn "objectSlug\|object_config" src/ | head -20
```

### 1e. Build the user story map

Write `qa-results/story-map.md`:

```markdown
# User Story Map
Generated from codebase analysis on [date]

## Entities
- Contacts: CRUD, list view, detail view, notes, tasks
- Companies: CRUD, list view, detail view
- Deals: CRUD, list view, kanban view, detail view
- Tasks: CRUD, list view, mark done
- [Custom objects]: CRUD via generic ObjectListPage/RecordDetailPage

## Pages & Flows
| # | Page/Flow | URL | Key Actions | Components |
|---|-----------|-----|-------------|------------|
| 1 | Home | /home | View recent records, quick chat | HomePage |
| 2 | Contact list | /objects/contacts | View, sort, filter, create, inline edit | ObjectListPage, DataTable |
| ... | ... | ... | ... | ... |

## Forms & Modals
| # | Form | Trigger | Fields | Validation |
|---|------|---------|--------|------------|
| 1 | Create Contact | "New" button on contacts list | name, email, phone, ... | name required |
| ... | ... | ... | ... | ... |

## Interactive Elements
| # | Element | Location | Expected Behavior |
|---|---------|----------|-------------------|
| 1 | View tabs | Object list header | Switch between saved views |
| 2 | Sort pills | Object list header | Click to toggle sort direction |
| ... | ... | ... | ... |
```

---

## PHASE 2: PLAN PARALLEL TEST EXECUTION

Group stories into independent test groups that can run in parallel subagents.

### Grouping strategy

- **Group by entity:** Each entity's full CRUD lifecycle is one group
- **Group by feature area:** Auth, settings, chat, automations, import
- **Keep groups independent:** No group depends on another group's data

### Example groupings

```
Group 1: Auth & Navigation (login, sidebar nav, command palette, deep links)
Group 2: Contacts CRUD (list, create, edit, delete, detail, notes)
Group 3: Companies CRUD
Group 4: Deals CRUD + Kanban
Group 5: Tasks + Notes pages
Group 6: Settings, profile, connections
Group 7: Chat / AI features
Group 8: Import, automations
```

Each subagent writes results to `qa-results/[group-name].md`.

---

## PHASE 3: EXECUTE EVERY USER STORY

For each group, execute these test patterns. Use subagents for parallel execution.

### 3a. Authentication

- [ ] Login with valid credentials
- [ ] Login with wrong password — verify error message (not stack trace)
- [ ] Session persistence — refresh page, verify still logged in
- [ ] Sign out — verify redirect to login

### 3b. Full CRUD lifecycle (per entity)

**Create:**
- [ ] Open create modal/form
- [ ] Submit empty form — verify validation errors
- [ ] Fill required fields only — submit — verify success toast
- [ ] Fill ALL fields — submit — verify record appears in list
- [ ] Create with special characters in name (quotes, angle brackets, emoji)
- [ ] Create with very long strings (200+ chars in text fields)
- [ ] "Create more" toggle (if available) — verify modal stays open

**Read (List):**
- [ ] Verify records appear in list/table
- [ ] Verify column data matches what was entered
- [ ] Pagination — navigate to page 2 and back
- [ ] Empty state — verify helpful message when no records

**Read (Detail):**
- [ ] Click into a record — verify detail page loads
- [ ] All fields display correctly
- [ ] Tabs work (Overview, Notes, Activity, etc.)
- [ ] Back button returns to list
- [ ] Deep link — paste detail URL directly, verify it loads

**Update:**
- [ ] Edit a field in detail view — save — verify change persists
- [ ] Inline edit in table (if supported) — save — verify
- [ ] Refresh page after edit — verify change persisted (not just optimistic)
- [ ] Edit name field — verify list view updates

**Delete:**
- [ ] Delete from detail page — confirm dialog — verify removal
- [ ] Verify deleted record no longer appears in list

### 3c. Form validation

- [ ] Submit with empty required fields — verify field-level errors
- [ ] Enter invalid email format — verify validation
- [ ] Enter invalid phone format — verify validation
- [ ] Enter XSS payload `<script>alert('xss')</script>` — verify it's escaped, not executed
- [ ] Enter SQL injection `'; DROP TABLE contacts; --` — verify it's treated as text
- [ ] Enter unicode/emoji in text fields — verify display
- [ ] Enter extremely long text (1000+ chars) — verify handling

### 3d. Navigation

- [ ] Click every sidebar link — verify page loads
- [ ] Command palette (Cmd+K) — search for a record — navigate to it
- [ ] Breadcrumbs — click each segment — verify navigation
- [ ] Browser back/forward — verify state preservation
- [ ] Deep link every major URL — verify direct access works
- [ ] Navigate to non-existent route — verify 404 or redirect

### 3e. Interactive elements

- [ ] Sort columns — click header — verify data reorders
- [ ] Filter records — add filter — verify results narrow
- [ ] Remove filter — verify full list returns
- [ ] View tabs — switch views — verify columns/sorts/filters change
- [ ] Column resize (if supported) — drag header border
- [ ] Column hide/show — toggle via column menu or settings
- [ ] Kanban drag (deals) — move card between columns — verify stage updates
- [ ] Modals — open, close via X, close via Escape, close via click outside
- [ ] Dropdowns — open, select option, verify selection
- [ ] Tabs — click each tab — verify content changes
- [ ] Toggles/checkboxes — click — verify state change

### 3f. Empty, error, and loading states

- [ ] Navigate to list with no records — verify empty state message
- [ ] Trigger an error (e.g., navigate to deleted record) — verify error message
- [ ] Check that loading states exist (skeletons/spinners during data fetch)
- [ ] Verify no raw error objects or stack traces shown to user

### 3g. Edge cases

- [ ] Double-click submit button — verify no duplicate records created
- [ ] Rapid navigation between pages — verify no crashes
- [ ] Open same record in two tabs — edit in both — verify last write wins
- [ ] Refresh mid-form — verify no data loss warning or graceful handling
- [ ] Very long page (50+ records) — verify scrolling works

---

## PHASE 4: GENERATE REPORT

Combine all group results into `qa-results/REPORT.md`:

```markdown
# QA Report
**Date:** [date]
**App:** [name]
**Testing Mode:** [Electron CDP / Playwright Web]
**Tester:** Claude (qa-engineer skill)

## Executive Summary
- **Total tests executed:** X
- **Passed:** X
- **Failed:** X
- **Blocked:** X (couldn't test due to environment/data issues)

## Coverage Table

| Area | Tests | Pass | Fail | Blocked | Notes |
|------|-------|------|------|---------|-------|
| Auth | X | X | X | X | |
| Contacts CRUD | X | X | X | X | |
| Companies CRUD | X | X | X | X | |
| Deals CRUD + Kanban | X | X | X | X | |
| Tasks | X | X | X | X | |
| Navigation | X | X | X | X | |
| Forms & Validation | X | X | X | X | |
| Edge Cases | X | X | X | X | |
| **Total** | **X** | **X** | **X** | **X** | |

## Bugs Found

### BUG-001: [Short description]
**Severity:** Critical / High / Medium / Low
**Steps to reproduce:**
1. Navigate to /objects/contacts
2. Click "New Contact"
3. Leave all fields empty
4. Click "Create"

**Expected:** Validation error on required name field
**Actual:** Record created with blank name
**Screenshot:** [if taken]

---

### BUG-002: [Next bug]
[Same structure...]

---

## Detailed Test Results

### Auth & Navigation
| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Login with valid credentials | PASS | |
| 2 | Login with wrong password | FAIL | Shows raw 401 JSON instead of error message |
| ... | ... | ... | ... |

### Contacts CRUD
[Same table format...]

[Continue for each group...]

## Recommendations
1. [Priority fix 1]
2. [Priority fix 2]
3. [Priority fix 3]
```

---

## BEHAVIORAL RULES

1. **Always discover before testing.** For full QA, Phase 1 (codebase analysis) runs BEFORE you
   open a browser. For targeted QA, Step T1 (understanding what was built) runs first — read the
   git diff and conversation context so you know exactly what to test.

2. **Always snapshot before and after.** Never click blind. The snapshot -> act -> snapshot -> verify
   loop is non-negotiable for every single interaction.

3. **Actually verify persistence.** After creating or editing a record, REFRESH the page and verify
   the data is still there. Optimistic UI can lie — the database is the truth.

4. **Test like a real user, not a robot.** Click things in the order a human would. Fill forms
   field by field. Read error messages. Try the obvious happy path first, then edge cases.

5. **Report what you actually observed.** Never write "PASS" for something you didn't test.
   If you couldn't test it (blocked by environment, auth, missing data), mark it "BLOCKED" with
   an explanation.

6. **Use parallel subagents for independent test groups.** Don't test everything sequentially
   when groups are independent. Each subagent gets its own browser session and writes to its own
   results file.

7. **Keep bug reports actionable.** Every bug needs: steps to reproduce, expected behavior, actual
   behavior. A bug report without repro steps is useless.

8. **Don't over-engineer the testing.** No visual regression tools, no performance benchmarks,
   no accessibility scanners, no cross-browser matrix. Just use the product like a human and
   find what's broken.

9. **Close all browser sessions when done.** Electron: no cleanup needed (app stays running).
   Playwright: `playwright-cli close-all`.

10. **Create the qa-results directory at the start.** All output goes to `qa-results/`.
    ```bash
    mkdir -p qa-results
    ```
