# Desktop App — Platform Context

## Stack
- **Framework**: Electron v33+ (`apps/desktop/`)
- **Main process**: TypeScript compiled to `dist/main/index.js`
- **Renderer**: Loads web app from `http://localhost:3000` (dev) or bundled Next.js (prod)
- **Overlay**: Second BrowserWindow — transparent, always-on-top, floats over all apps

## Running Locally

```bash
# Prerequisites: web app must be running on :3000
cd apps/desktop && BASICOS_URL=http://localhost:3000 npx electron dist/main/index.js
# Or after build:
pnpm --filter @basicos/desktop dev
```

## Window Architecture

Two windows:

### 1. Main Dashboard Window
- Full Basics OS web portal in a native macOS app frame
- `titleBarStyle: "hiddenInset"` for macOS traffic lights
- Loads `BASICOS_URL` (defaults to `http://localhost:3000`)

### 2. Overlay Window  
- Transparent (`transparent: true`)
- Always on top (`setAlwaysOnTop(true, "screen-saver")`)
- Visible on all workspaces including fullscreen apps
- Positioned top-right corner
- Hides on blur (click outside = dismiss)
- Loads `BASICOS_URL/overlay`

## Global Hotkey

`Cmd+Shift+Space` (macOS) / `Ctrl+Shift+Space` (Windows/Linux) toggles the overlay.
Registered in main process via `globalShortcut.register("CommandOrControl+Shift+Space", ...)`.

## Overlay Page

The overlay is a Next.js page at `/overlay` (`apps/web/src/app/overlay/page.tsx`).
It's a dark HUD with:
- Search bar for asking questions
- Quick action buttons (links to modules)
- "Open Basics OS Dashboard" button

To add a widget to the overlay, edit `apps/web/src/app/overlay/page.tsx`.

## Tray Icon

A system tray icon appears in the menu bar. Right-click shows:
- Open Basics OS
- Toggle Overlay (⌘⇧Space)
- Quit

## White-Label Branding

On first launch, the desktop app fetches `GET /api/branding` from the web server.
This returns `companyName`, `logoUrl`, `accentColor`, and service URLs.
The response is cached locally so it loads instantly on subsequent launches.

## IPC Patterns (Main ↔ Renderer)

Not yet implemented. For future use:
```ts
// Renderer → Main
import { ipcRenderer } from "electron";
ipcRenderer.send("toggle-overlay");

// Main → Renderer  
mainWindow.webContents.send("notification", { title: "New task assigned" });
```

## Building for Distribution

```bash
pnpm --filter @basicos/desktop package  # builds .dmg for macOS
```

Uses `electron-builder` with config in `apps/desktop/electron-builder.yml` (not yet created).
Target: macOS universal binary (arm64 + x86_64).

## Key Files

| File | Purpose |
|------|---------|
| `apps/desktop/src/main/index.ts` | Entry point — creates windows, tray, hotkey |
| `apps/web/src/app/overlay/page.tsx` | The overlay HUD UI |
| `apps/web/src/app/api/branding/route.ts` | Branding config endpoint |
