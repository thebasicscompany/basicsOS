# Restart Dev Environment

Properly kill all processes and restart the BasicsOS dev environment (server + Electron + CDP).

## Steps

1. **Kill everything** — run all kills in one command:
```bash
pkill -f Electron 2>/dev/null; pkill -f electron 2>/dev/null; pkill -f "tsx watch" 2>/dev/null; pkill -f "turbo run dev" 2>/dev/null; pkill -f concurrently 2>/dev/null; pkill -f "electron-vite" 2>/dev/null; sleep 2; echo "All processes killed"
```

2. **Verify ports are free** — check that 3001 (API) and 5173 (Vite) are not in use:
```bash
lsof -ti:3001 -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null; echo "Ports cleared"
```

3. **Start fresh** — run in background:
```bash
REMOTE_DEBUGGING_PORT=9222 pnpm run dev:all
```
Run this in the background so the conversation isn't blocked.

4. **Wait and verify** — after ~15 seconds, confirm the server is up:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health
```
If it returns `200`, the server is ready. If not, read the background task output for errors.

## Common Issues

- **Port already in use**: Step 2 handles this by killing anything on those ports.
- **Stale tsx watch processes**: Old server instances from previous sessions can hold port 3001. Step 1 kills these.
- **Login not working**: Usually means the API server didn't start. Check the background task output for DB connection errors or migration issues.
- **Docker not running**: The server needs Postgres on port 5435. Run `docker compose up -d` if needed.
