# Company Assets

This folder is the single source of truth for your company's brand assets.
Replace these files with your own, then run `bun run assets:sync` to propagate
them to all apps.

## Files

| File | Purpose | Recommended size |
|------|---------|-----------------|
| `icon.svg` | App icon — used as browser favicon, sidebar logo, and app icon | 1024×1024, square |

## Syncing

```bash
bun run assets:sync
```

Copies assets to:
- `apps/web/public/` — served as static files (favicon, NavClient logo)
- `apps/mobile/assets/` — Expo app icon
- `apps/desktop/resources/` — Electron app icon
