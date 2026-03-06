---
name: pill-feature
description: >
  Build features that integrate with the BasicsOS voice pill/overlay. Handles Electron IPC,
  pill state machine extensions, screen capture, voice commands, and the companion management
  app in the main window. Use when the feature involves the overlay, pill, voice, dictation,
  screen recording, or any Electron-specific capability.

  ALWAYS use this skill when the user asks to: add to the pill, add to the overlay, add voice
  commands, add screen capture, add screen recording, build a workflow recorder, teach workflows,
  add dictation features, add meeting features, extend the pill, modify the overlay,
  "add recording to the pill", "build like Scribe", "workflow capture", "pill integration",
  or any request involving the Electron overlay or pill UI.
allowed-tools:
  - Bash(pnpm:*)
  - Bash(npx:*)
  - Bash(ls:*)
  - Bash(mkdir:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
user_invocable: true
---

# Pill/Overlay Feature Builder

You build features that span the Electron overlay pill and the main BasicsOS web app. This is
the most architecturally complex feature type — it crosses process boundaries (overlay ↔ main ↔
server), uses Electron IPC, and requires careful state machine management.

---

## MANDATORY: READ THESE FILES FIRST

Before writing ANY code:

```
Read .claude/skills/frontend-dev/UI-REFERENCE.md  (especially section 6b — ALL subsections)
Read AGENTS.md
Read .claude/skills/frontend-dev/SKILL.md
Read .claude/skills/backend-dev/SKILL.md
```

Section 6b is your primary reference. It documents:
- 6b.1: Pill visual states (idle, listening, thinking, transcribing, response)
- 6b.2: State machine (states, modes, actions)
- 6b.3: File locations for every overlay component
- 6b.4: Electron window config and all IPC channels
- 6b.5: Keyboard shortcuts
- 6b.6: Voice commands
- 6b.7: Audio pipeline
- 6b.8: Settings structure
- 6b.9: Modification guide
- 6b.10: Screen capture pipeline
- 6b.11: Adding new IPC channels

Section 10 "Overlay ↔ App Data Sharing" explains cross-process data flow.
Section 8 "Adding a Pill-Integrated Feature" gives the combined checklist.

---

## PHASE 1: UNDERSTAND THE ARCHITECTURE

The pill/overlay system has three separate processes. Code in one process CANNOT directly
call code in another — all communication goes through IPC.

```
┌─────────────────┐     IPC      ┌─────────────────┐     IPC      ┌─────────────────┐
│  Overlay Window  │ ◄──────────► │  Main Process    │ ◄──────────► │  Main Window     │
│  (src/overlay/)  │              │  (src/main/)     │              │  (src/components/)│
│                  │              │                  │              │                  │
│  - OverlayApp    │              │  - shortcut-mgr  │              │  - React app     │
│  - pill state    │              │  - settings-store│              │  - TanStack Query│
│  - voice capture │              │  - IPC handlers  │              │  - Router        │
│  - API proxy     │              │  - screen capture│              │  - All hooks     │
└─────────────────┘              └─────────────────┘              └─────────────────┘
         │                                                                  │
         │              proxyOverlayRequest                                 │
         └──────────────────► Backend API ◄─────────────────────────────────┘
                              (packages/server/)
```

Key constraints:
- The overlay has NO TanStack QueryClient — it can't use React hooks from the main app
- The overlay calls the API via `proxyOverlayRequest` (IPC → main process → fetch)
- To refresh main app data after overlay actions, use IPC to trigger `queryClient.invalidateQueries`
- The overlay is a frameless, transparent, always-on-top window with mouse passthrough

---

## PHASE 2: PLAN THE FEATURE

Every pill-integrated feature has up to 5 parts. Determine which you need:

### Part 1: Pill State Extension (almost always needed)

**When:** The pill needs to show a new state (e.g., "recording", "replaying")

**Where:** `src/overlay/lib/notch-pill-state.ts`

**How:**
1. Add new state(s) to the state enum (e.g., `recording`)
2. Add new action types (e.g., `RECORDING_START`, `RECORDING_STOP`, `RECORDING_STEP`)
3. Add transitions in the reducer — define which states can transition to which
4. Keep existing states untouched — add alongside, never restructure

**Risk:** HIGH — this reducer controls all pill behavior. Test that existing states still work.

**Visual component:** Add the new state's visual in `src/overlay/lib/pill-components.tsx`.
Follow the height/appearance pattern from 6b.1:

| State | Height | Appearance |
|-------|--------|------------|
| Your new state | Define height | Describe visuals (icons, animations, text) |

### Part 2: IPC Channels (needed for Electron API access)

**When:** You need Electron capabilities (screen capture, clipboard, file system, notifications)

**Where:** Follow the 6b.11 pattern — three files must be updated:
1. `src/main/index.ts` (or new manager file) — `ipcMain.handle('channel-name', handler)`
2. `src/preload/overlay.ts` — `contextBridge.exposeInMainWorld` + `ipcRenderer.invoke`
3. `src/shared-overlay/types.ts` — add method to `ElectronAPI` interface

**Direction patterns:**
- Overlay asks main: `window.electronAPI.doThing()` → `ipcRenderer.invoke` → `ipcMain.handle`
- Main tells overlay: `overlayWindow.webContents.send('event')` → `ipcRenderer.on` → `electronAPI.onEvent(cb)`

### Part 3: Screen Capture (if visual recording is needed)

**When:** Workflow recording, screenshot annotation, visual context

**Where:** Follow the 6b.10 pattern:
1. `src/main/screen-capture-manager.ts` — `desktopCapturer.getSources()`, permission checks
2. `src/overlay/lib/screen-capture.ts` — capture via `getUserMedia` with `chromeMediaSource: 'desktop'`
3. New IPC channels: `getScreenSources`, `startScreenCapture`, `stopScreenCapture`, `captureScreenshot`

**macOS permission:** Requires Screen Recording in System Settings > Privacy. Include
`NSScreenCaptureDescription` in Info.plist. Detect + prompt if not granted.

### Part 4: Voice Commands & Shortcuts (if voice/keyboard triggered)

**Voice commands:** `src/overlay/lib/voice-commands.ts` — add pattern to the matcher array.
Return a command object that the pill state machine dispatches.

**Keyboard shortcuts:** Two places:
1. `src/main/shortcut-manager.ts` — register the global shortcut in main process
2. Overlay settings in `src/shared-overlay/types.ts` — add to OverlaySettings so user can customize

### Part 5: Management App (almost always needed for non-trivial features)

**When:** The feature produces data that needs viewing, editing, or management.

**This is a regular BasicsOS app.** Follow UI-REFERENCE.md section 8 "Adding a New App":
1. Page component in `src/components/pages/`
2. Route in `src/App.tsx` at `/{feature-name}` (NOT under `/objects/`)
3. Sidebar entry in `app-sidebar.tsx` (hardcoded, NOT ObjectRegistryNavSection)
4. Own hooks in `src/hooks/` with own query keys
5. Backend routes in `packages/server/src/routes/`

**Connecting to the overlay:**
- Overlay saves data via `proxyOverlayRequest` → backend API
- Overlay opens app via `window.electronAPI.navigateMain('/feature/:id')`
- App refreshes after overlay actions via IPC → `queryClient.invalidateQueries(['feature'])`

---

## PHASE 3: SUGGEST BETTER APPROACHES

Before building, evaluate whether the user's approach is optimal. Common corrections:

### "Put it all in the pill"
Push back: The pill is 400px wide with limited height. It's for triggering actions and showing
brief feedback, not for complex management UIs. Heavy management (lists, editing, configuration)
belongs in the main app. The pill triggers recording, shows status, and links to the management
app via `navigateMain`.

### "Store recordings in the database"
Push back: Screenshots and video are large binary assets. Store files on disk (or S3/cloud
storage), store file paths + metadata in the database. The API returns metadata with file URLs.

### "Use the existing automation system for replay"
Consider: This could work for simple workflows. The automation system already has a node
execution engine with topological sort. You could create new node types
(`TriggerWorkflowReplayNode`, `ClickActionNode`, `TypeActionNode`) and reuse the builder canvas.
But if replay needs real-time screen interaction, it needs Electron's `robotjs` or similar,
which is a different execution model than the server-side automation runner.

### "Make workflows a CRM object"
Push back: Workflows have steps, recordings, playback logic — they're not flat records with
fields. This is an app, not an object. The list/detail pattern from ObjectListPage won't fit a
step editor, screenshot viewer, or replay controls.

### "Just add a button to the overlay"
Check: Does the button need persistent state? Does it produce data? If yes, you need the full
pill state + IPC + backend + management app stack. A simple button that triggers an existing
action (like navigating somewhere) can just use `navigateMain` IPC.

---

## PHASE 4: PRESENT PLAN & BUILD

### 4a. Present the plan

```markdown
## Pill Feature Plan: {Name}

### Parts Needed
- [ ] Pill state extension — {new states}
- [ ] IPC channels — {list of channels}
- [ ] Screen capture — {yes/no, why}
- [ ] Voice commands — {trigger phrases}
- [ ] Keyboard shortcut — {key combo}
- [ ] Management app — {route, purpose}
- [ ] Backend API — {routes, DB tables}
- [ ] Automation integration — {trigger/action nodes, if applicable}

### Files to Create
- `src/overlay/lib/{feature}.ts` — {purpose}
- `src/main/{feature}-manager.ts` — {purpose}
- `src/components/pages/{Feature}Page.tsx` — management app
- `src/hooks/use-{feature}.ts` — data hooks
- `packages/server/src/routes/{feature}.ts` — API routes

### Files to Modify
- `src/overlay/lib/notch-pill-state.ts` — add {states} (HIGH RISK)
- `src/overlay/lib/pill-components.tsx` — add {state} visuals
- `src/overlay/lib/voice-commands.ts` — add {commands}
- `src/preload/overlay.ts` — expose {IPC channels}
- `src/shared-overlay/types.ts` — add to ElectronAPI interface
- `src/main/index.ts` — register {IPC handlers}
- `src/App.tsx` — add route
- `src/components/app-sidebar.tsx` — add nav entry

### Risk Assessment
- notch-pill-state.ts: HIGH RISK — test all existing states still work
- proxyOverlayRequest: HIGH RISK if modifying auth flow
- {other risks from UI-REFERENCE.md section 12}

### Data Flow
Overlay → {IPC channel} → Main Process → {action} → Backend API
Backend API → Main Window hooks → queryClient.invalidateQueries
Overlay → navigateMain → Main Window router → /feature/:id
```

Wait for approval.

### 4b. Build in dependency order

1. **Types** — ElectronAPI interface additions, shared types
2. **Backend** — DB schema, API routes, Drizzle migration
3. **Main process** — IPC handlers, managers
4. **Preload** — IPC bridge
5. **Overlay** — state machine additions, pill visuals, voice commands
6. **Main app** — management page, hooks, route, sidebar
7. **Wiring** — connect overlay → API → main app invalidation

### 4c. Validate

```bash
pnpm run typecheck
pnpm run lint
pnpm run build
```

Then run through the "Checklist: Changed Voice Pill" from UI-REFERENCE.md section 18.

---

## BEHAVIORAL RULES

1. **Read section 6b completely.** It has every file path, IPC channel, state, animation timing,
   and setting for the pill. Don't guess — look it up.

2. **Respect process boundaries.** Overlay code cannot import from `src/components/`. Main window
   code cannot import from `src/overlay/`. All cross-process communication goes through IPC.

3. **Don't bloat the pill UI.** The pill is a 400px-wide notification bar, not a full app.
   Complex UIs belong in the management app. The pill shows status and provides quick triggers.

4. **Add states alongside, never restructure.** The pill state reducer is HIGH RISK. Your new
   states must coexist with existing ones. Test that idle, listening, thinking, transcribing,
   and response all still work correctly.

5. **Follow the IPC channel pattern exactly.** Three files: main handler, preload bridge, type
   definition. Miss one and TypeScript won't catch the runtime error.

6. **Backend is the shared data layer.** Both overlay (via proxy) and main app (via fetchApi)
   hit the same API. Never share state directly between windows.

7. **Document the invalidation chain.** When the overlay creates data, how does the main app
   learn about it? IPC → queryClient.invalidateQueries. Write this down in the plan.

8. **Screen capture needs permissions.** macOS won't silently fail — it just returns empty
   frames. Always check permission status and show a clear prompt to the user.

9. **Suggest the right approach.** If the user wants everything in the pill, push back with
   the pill/app split. If they want a CRM object, explain why it's an app. Always reference
   specific UI-REFERENCE.md sections.

10. **Validate everything.** Typecheck, lint, build. Pill features touch many files across
    multiple processes — one missed type will cause a runtime crash.
