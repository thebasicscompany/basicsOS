# Desktop App — Platform Context

## Stack
- **Framework**: Electron v33+ (`apps/desktop/`)
- **Build system**: electron-vite (dev server with HMR, production build to `dist/`)
- **Main process**: TypeScript → `dist/main/index.js`
- **Preload**: TypeScript → `dist/preload/index.js` (contextBridge → `window.electronAPI`)
- **Overlay renderer**: Local React app bundled by electron-vite (NOT a web URL)
- **Main window renderer**: Loads web app from `BASICOS_URL` (default `http://localhost:3000`)

## Running Locally

```bash
# Prerequisites: web app must be running on :3000, API on :3001
pnpm --filter @basicsos/desktop dev    # electron-vite dev (HMR for overlay renderer)
pnpm --filter @basicsos/desktop build  # electron-vite build → dist/
pnpm --filter @basicsos/desktop package  # electron-builder → .dmg/.exe
```

## Window Architecture

Two windows:

### 1. Main Dashboard Window
- Full Basics OS web portal in a native macOS app frame
- `titleBarStyle: "hiddenInset"` for macOS traffic lights
- Loads `BASICOS_URL` (defaults to `http://localhost:3000`)
- Auth: session cookie is set by Better Auth in `session.defaultSession` — same as a browser
- No preload script needed (runs the full web app)

### 2. Overlay Window
- **420x480px**, frameless, transparent, always-on-top (`setAlwaysOnTop(true, "screen-saver")`)
- Visible on all workspaces including fullscreen apps
- `vibrancy: "under-window"` for macOS blur effect, `skipTaskbar: true`
- **Local React renderer** — in dev: loads `ELECTRON_RENDERER_URL` (Vite dev server with HMR); in prod: loads `dist/renderer/index.html`
- Navigation away from the local renderer is blocked (`will-navigate` → `preventDefault()`)
- `sandbox: false` required for contextBridge preload
- Tabs: Ask (AI chat), Meetings (quick-join), Voice (Web Speech API dictation)

## Global Hotkey

`Cmd+Shift+Space` (macOS) / `Ctrl+Shift+Space` (Windows/Linux) toggles the overlay.
Registered in main process via `globalShortcut.register("CommandOrControl+Shift+Space", ...)`.
Overlay does NOT hide on blur — toggle only via hotkey.

## Auth: IPC Cookie Extraction

The overlay runs a local renderer (no web cookies). It authenticates via IPC:

1. Overlay renderer calls `window.electronAPI.getSessionToken()`
2. Preload bridge invokes `ipcMain.handle("get-session-token")`
3. Main process reads `better-auth.session_token` from `session.defaultSession.cookies`
4. Token is returned to the overlay, which sends it as `Authorization: Bearer <token>` to the API

```ts
// In overlay renderer:
const token = await window.electronAPI.getSessionToken();
const apiUrl = await window.electronAPI.getApiUrl();
const res = await fetch(`${apiUrl}/stream/assistant`, {
  headers: { Authorization: `Bearer ${token}` },
  // ...
});
```

## Preload Bridge: `window.electronAPI`

Exposed via `contextBridge.exposeInMainWorld("electronAPI", ...)` in `apps/desktop/src/preload/index.ts`:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `send` | `(channel: string, ...args: unknown[]) => void` | One-way IPC (validated channels: `set-ignore-mouse`, `navigate-main`) |
| `injectText` | `(text: string) => Promise<void>` | Clipboard + simulated paste into active field |
| `captureScreen` | `() => Promise<string>` | Screenshot primary display → base64 PNG |
| `getSessionToken` | `() => Promise<string \| null>` | Extract session cookie for API auth |
| `getApiUrl` | `() => Promise<string>` | Get API server URL (`BASICOS_API_URL` or `http://localhost:3001`) |

## IPC Channels (Main Process)

| Channel | Type | Handler |
|---------|------|---------|
| `get-session-token` | `ipcMain.handle` | Reads `better-auth.session_token` cookie |
| `get-api-url` | `ipcMain.handle` | Returns `BASICOS_API_URL` env var |
| `inject-text` | `ipcMain.handle` | Copies text to clipboard, simulates paste via osascript (macOS) / PowerShell (Windows) |
| `capture-screen` | `ipcMain.handle` | Hides overlay → `desktopCapturer` screenshot → returns base64 PNG |
| `set-ignore-mouse` | `ipcMain.on` | Toggles click-through mode on overlay |
| `navigate-main` | `ipcMain.on` | Loads a URL in the main window |

## White-Label Branding

On `app.whenReady()`, before any windows are created:
1. `fetchBranding()` calls `GET ${WEB_URL}/api/branding` (3-second timeout)
2. Returns `{ companyName, logoUrl, accentColor, apiUrl, mcpUrl }`
3. Falls back to `DEFAULT_BRANDING` on any error
4. Used to set window title and tray tooltip

Branding values are cached in memory for the app session lifetime.

## Auto-Updates

- Uses `electron-updater` (`autoUpdater`)
- Only active when `app.isPackaged` (skipped in dev)
- Checks for updates on startup via `autoUpdater.checkForUpdatesAndNotify()`
- Tray menu "Check for Updates" also triggers a check
- Handles `update-available` and `update-downloaded` events (currently logs only)

## Tray Icon

A system tray icon appears in the menu bar. Menu items:
- Open Basics OS (shows main window)
- Toggle Overlay (Cmd+Shift+Space)
- Check for Updates
- Quit

## Building for Distribution

```bash
pnpm --filter @basicsos/desktop package  # electron-builder → .dmg (macOS), .exe (Windows)
```

Uses `electron-builder` config in `apps/desktop/`. Target: macOS universal binary (arm64 + x86_64).

## Key Files

| File | Purpose |
|------|---------|
| `apps/desktop/src/main/index.ts` | Entry point — windows, tray, hotkey, IPC, branding, auto-update |
| `apps/desktop/src/preload/index.ts` | contextBridge → `window.electronAPI` |
| `apps/desktop/src/renderer/` | Local React overlay app (electron-vite bundled) |
| `apps/desktop/electron.vite.config.ts` | electron-vite config (main + preload + renderer) |
| `apps/web/src/app/api/branding/route.ts` | Branding config endpoint |

## Adding Features to the Overlay

1. Edit the overlay React app in `apps/desktop/src/renderer/`
2. Use `window.electronAPI` for native capabilities (screenshots, text injection)
3. Auth: call `getSessionToken()` → include as Bearer token in API requests
4. API URL: call `getApiUrl()` → use for all API requests
5. Run `pnpm --filter @basicsos/desktop dev` for HMR during development
