---
name: electron
description: Automate Electron desktop apps (VS Code, Slack, Discord, Figma, Notion, Spotify, etc.) using agent-browser via Chrome DevTools Protocol. Use when the user needs to interact with an Electron app, automate a desktop app, connect to a running app, control a native app, or test an Electron application. Triggers include "automate Slack app", "control VS Code", "interact with Discord app", "test this Electron app", "connect to desktop app", or any task requiring automation of a native Electron application.
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*)
---

# Electron App Automation

Automate any Electron desktop app using agent-browser. Electron apps are built on Chromium and expose a Chrome DevTools Protocol (CDP) port that agent-browser can connect to, enabling the same snapshot-interact workflow used for web pages.

## Core Workflow

1. **Launch** the Electron app with remote debugging enabled
2. **Connect** agent-browser to the CDP port
3. **Snapshot** to discover interactive elements
4. **Interact** using element refs
5. **Re-snapshot** after navigation or state changes

```bash
# Launch an Electron app with remote debugging
open -a "Slack" --args --remote-debugging-port=9222

# Connect agent-browser to the app
agent-browser connect 9222

# Standard workflow from here
agent-browser snapshot -i
agent-browser click @e5
agent-browser screenshot slack-desktop.png
```

## Launching Electron Apps with CDP

Every Electron app supports the `--remote-debugging-port` flag since it's built into Chromium.

### macOS

```bash
# Slack
open -a "Slack" --args --remote-debugging-port=9222

# VS Code
open -a "Visual Studio Code" --args --remote-debugging-port=9223

# Discord
open -a "Discord" --args --remote-debugging-port=9224

# Figma
open -a "Figma" --args --remote-debugging-port=9225

# Notion
open -a "Notion" --args --remote-debugging-port=9226

# Spotify
open -a "Spotify" --args --remote-debugging-port=9227
```

### Linux

```bash
slack --remote-debugging-port=9222
code --remote-debugging-port=9223
discord --remote-debugging-port=9224
```

### Windows

```bash
"C:\Users\%USERNAME%\AppData\Local\slack\slack.exe" --remote-debugging-port=9222
"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe" --remote-debugging-port=9223
```

**Important:** If the app is already running, quit it first, then relaunch with the flag. The `--remote-debugging-port` flag must be present at launch time.

## Connecting

```bash
# Connect to a specific port
agent-browser connect 9222

# Or use --cdp on each command
agent-browser --cdp 9222 snapshot -i

# Auto-discover a running Chromium-based app
agent-browser --auto-connect snapshot -i
```

After `connect`, all subsequent commands target the connected app without needing `--cdp`.

## Tab Management

Electron apps often have multiple windows or webviews. Use tab commands to list and switch between them:

```bash
# List all available targets (windows, webviews, etc.)
agent-browser tab

# Switch to a specific tab by index
agent-browser tab 2

# Switch by URL pattern
agent-browser tab --url "*settings*"
```

## Common Patterns

### Inspect and Navigate an App

```bash
open -a "Slack" --args --remote-debugging-port=9222
sleep 3  # Wait for app to start
agent-browser connect 9222
agent-browser snapshot -i
# Read the snapshot output to identify UI elements
agent-browser click @e10  # Navigate to a section
agent-browser snapshot -i  # Re-snapshot after navigation
```

### Take Screenshots of Desktop Apps

```bash
agent-browser connect 9222
agent-browser screenshot app-state.png
agent-browser screenshot --full full-app.png
agent-browser screenshot --annotate annotated-app.png
```

### Extract Data from a Desktop App

```bash
agent-browser connect 9222
agent-browser snapshot -i
agent-browser get text @e5
agent-browser snapshot --json > app-state.json
```

### Fill Forms in Desktop Apps

```bash
agent-browser connect 9222
agent-browser snapshot -i
agent-browser fill @e3 "search query"
agent-browser press Enter
agent-browser wait 1000
agent-browser snapshot -i
```

### Run Multiple Apps Simultaneously

Use named sessions to control multiple Electron apps at the same time:

```bash
# Connect to Slack
agent-browser --session slack connect 9222

# Connect to VS Code
agent-browser --session vscode connect 9223

# Interact with each independently
agent-browser --session slack snapshot -i
agent-browser --session vscode snapshot -i
```

## Color Scheme

Playwright overrides the color scheme to `light` by default when connecting via CDP. To preserve dark mode:

```bash
agent-browser connect 9222
agent-browser --color-scheme dark snapshot -i
```

Or set it globally:

```bash
AGENT_BROWSER_COLOR_SCHEME=dark agent-browser connect 9222
```

## Troubleshooting

### "Connection refused" or "Cannot connect"

- Make sure the app was launched with `--remote-debugging-port=NNNN`
- If the app was already running, quit and relaunch with the flag
- Check that the port isn't in use by another process: `lsof -i :9222`

### App launches but connect fails

- Wait a few seconds after launch before connecting (`sleep 3`)
- Some apps take time to initialize their webview

### Elements not appearing in snapshot

- The app may use multiple webviews. Use `agent-browser tab` to list targets and switch to the right one
- Use `agent-browser snapshot -i -C` to include cursor-interactive elements (divs with onclick handlers)

### Cannot type in input fields

- Try `agent-browser keyboard type "text"` to type at the current focus without a selector
- Some Electron apps use custom input components; use `agent-browser keyboard inserttext "text"` to bypass key events

## Supported Apps

Any app built on Electron works, including:

- **Communication:** Slack, Discord, Microsoft Teams, Signal, Telegram Desktop
- **Development:** VS Code, GitHub Desktop, Postman, Insomnia
- **Design:** Figma, Notion, Obsidian
- **Media:** Spotify, Tidal
- **Productivity:** Todoist, Linear, 1Password

If an app is built with Electron, it supports `--remote-debugging-port` and can be automated with agent-browser.

## Element Selection & Code Mapping

Map visual elements back to React component names and source file locations using `react-grab`.

### Enabling CDP on Electron Apps

For apps using `electron-vite`, add this to the main process entry (before `app.whenReady()`):

```typescript
if (process.env["REMOTE_DEBUGGING_PORT"]) {
  app.commandLine.appendSwitch("remote-debugging-port", process.env["REMOTE_DEBUGGING_PORT"]);
}
```

Then launch with: `REMOTE_DEBUGGING_PORT=9222 electron-vite dev`

For direct Electron launch (pre-built apps):
```bash
/path/to/Electron.app/Contents/MacOS/Electron --remote-debugging-port=9222 .
```

**Important:** `file://` protocol blocks external script loading. Electron apps must be served via the dev server (e.g., `electron-vite dev` sets `ELECTRON_RENDERER_URL`) for react-grab injection to work optimally. For `file://` apps, download the script first and inject inline (see below).

### Approach 1: Runtime Injection (Any React Electron App)

Inject react-grab into a running app via CDP without modifying its source code.

#### Step 1: Inject the Script

**For apps served via dev server (http://):**
```bash
agent-browser eval "var s=document.createElement('script');s.src='https://unpkg.com/react-grab/dist/index.global.js';document.head.appendChild(s);"
```

**For apps loaded from file:// (inline injection):**
```bash
# Download once
curl -sL https://unpkg.com/react-grab/dist/index.global.js -o /tmp/react-grab-global.js

# Inject inline via eval
agent-browser eval "$(cat /tmp/react-grab-global.js); typeof globalThis.__REACT_GRAB_MODULE__"
```

The global is `globalThis.__REACT_GRAB_MODULE__` (not `window.__REACT_GRAB__`).

#### Step 2: Initialize and Inspect Elements

Write inspection logic to a JS file to avoid shell quoting issues, then eval it:

```javascript
// /tmp/inspect-element.js
(async function() {
  var mod = globalThis.__REACT_GRAB_MODULE__;
  mod.init();
  var api = mod.getGlobalApi();
  api.activate();

  var el = document.querySelector('button'); // or use elementFromPoint(x, y)
  if (!el) return JSON.stringify({ error: 'No element found' });

  var info = await mod.formatElementInfo(el);
  var source = await api.getSource(el);
  var stack = await mod.getStack(el);

  return JSON.stringify({ info: info, source: source, stack: stack }, null, 2);
})()
```

```bash
agent-browser eval "$(cat /tmp/inspect-element.js)"
```

**Verified output format** (tested on BasicsOS Electron app):
```
<button data-slot="button" type="submit">
  Create account
</button>
  in Button (at src/components/ui/button.tsx)
  in SignupPage (at src/components/auth/signup-page.tsx)
  in GatewayProvider (at src/providers/GatewayProvider.tsx)
```

The `source` object returns: `{ filePath, lineNumber, componentName }` — e.g., `{ filePath: "src/components/ui/button.tsx", lineNumber: 50, componentName: "Button" }`.

The `stack` array returns full component ancestry with file paths and line/column numbers for each component in the tree.

#### How react-grab Works Internally

react-grab uses the `bippy` library to:
1. Access React fiber internals via `getFiberFromHostInstance(element)`
2. Walk the fiber tree upward to find component names via `getDisplayName(fiber.type)`
3. Extract owner stack frames containing **source file paths and line numbers**
4. Filter out framework internals (React Router, Radix, styled-components)

**Important:** Source file paths and line numbers are only available in **development builds**. Production builds provide component names but not file locations.

### Approach 2: Direct Fiber Walking (No Dependencies)

When react-grab injection isn't possible, walk the React fiber tree directly:

```javascript
// /tmp/fiber-walk.js
(function() {
  var el = document.querySelector('button'); // target element
  var fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber'); });
  if (!fiberKey) return JSON.stringify({ error: 'No React fiber found' });

  var fiber = el[fiberKey];
  var components = [];
  var current = fiber;
  while (current && components.length < 20) {
    if (current.type && typeof current.type === 'function') {
      var entry = { name: current.type.displayName || current.type.name || 'Anonymous' };
      if (current._debugSource) entry.source = current._debugSource;
      if (current._debugOwner && current._debugOwner.type) {
        entry.owner = current._debugOwner.type.displayName || current._debugOwner.type.name;
      }
      components.push(entry);
    }
    current = current.return;
  }
  return JSON.stringify({ componentStack: components }, null, 2);
})()
```

**Verified output** (tested on BasicsOS):
```json
{
  "componentStack": [
    { "name": "Button", "owner": "SignupPage" },
    { "name": "SignupPage", "owner": "AppRoutes" },
    { "name": "GatewayProvider", "owner": "AppRoutes" },
    { "name": "AppRoutes", "owner": "App" },
    { "name": "App" }
  ]
}
```

### Approach 3: Dev Build Integration (Your Own Apps)

For the best source mapping experience, install react-grab as a dev dependency:

```bash
npx -y grab@latest init
```

**Vite-based Electron apps** — add to your `index.html`:
```html
<script src="https://unpkg.com/react-grab/dist/index.global.js"></script>
```

**MCP integration** (enables react-grab as an MCP tool for Claude):
```bash
npx -y grab@latest add mcp
```

### Fallback: Non-React Apps (Pure DOM)

For Electron apps not built with React, extract element info manually:

```javascript
// /tmp/dom-inspect.js
(function() {
  var el = document.elementFromPoint(300, 200);
  return JSON.stringify({
    tag: el.tagName.toLowerCase(),
    id: el.id,
    classes: Array.from(el.classList),
    text: el.textContent.trim().slice(0, 100),
    selector: el.id ? '#' + el.id
      : el.getAttribute('data-testid') ? '[data-testid="' + el.getAttribute('data-testid') + '"]'
      : el.className ? '.' + Array.from(el.classList).join('.')
      : el.tagName.toLowerCase()
  });
})()
```

Then search the local codebase:
```bash
Grep -r "sidebar-nav" src/ --include="*.tsx"
Grep -r "data-testid=\"settings-btn\"" src/
```

### End-to-End Element-to-Code Workflow

1. **Screenshot** — Take an annotated screenshot to identify element refs
   ```bash
   agent-browser screenshot --annotate current-state.png
   ```

2. **Inject react-grab** — Download and inject inline (write JS to a file to avoid quoting issues)
   ```bash
   curl -sL https://unpkg.com/react-grab/dist/index.global.js -o /tmp/react-grab-global.js
   agent-browser eval "$(cat /tmp/react-grab-global.js); 'loaded'"
   ```

3. **Inspect element** — Write inspection JS to a file, then eval it
   ```bash
   # Write to /tmp/inspect.js, then:
   agent-browser eval "$(cat /tmp/inspect.js)"
   ```

4. **Find source code** — Use the file path and component name from the output
   ```bash
   Grep -r "ComponentName" src/
   Read src/components/path/from/output.tsx
   ```

5. **Modify** — Edit the source file directly

### Shell Quoting Tips

- **Always write JS to a file** and use `agent-browser eval "$(cat /tmp/file.js)"` — this avoids smart quote mangling, escape issues, and multi-line problems
- **Use `var` not `const/let`** in older eval contexts; wrap async code in `(async function() { ... })()`
- **Avoid template literals** in eval strings — use string concatenation instead
