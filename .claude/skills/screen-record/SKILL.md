# Screen Recording Skill

Record video of the running application and send it to the user via iMessage.

## When to use

ONLY trigger when the user explicitly asks: "send me a screen recording", "record what you did", "show me your work", "text me a video", "send me the recording", "record a demo"

Do NOT auto-trigger after making code changes. Wait for the user to ask.

## Tools

Use the `electron` skill for all app navigation (snapshot, click @ref, screenshot).
Use Bash for ffmpeg, osascript, and open commands.

## Protocol

### Phase 0: Ensure the Platform is Running

Check if the dev server and Electron app are up:

```bash
# Check services
curl -s http://localhost:5173 > /dev/null && echo "Frontend up" || echo "Frontend down"
curl -s http://localhost:9222/json > /dev/null && echo "CDP up" || echo "CDP down"
```

If not running, start it:

```bash
REMOTE_DEBUGGING_PORT=9222 pnpm run dev:all &
# Wait for CDP to be ready
for i in $(seq 1 30); do
  curl -s http://localhost:9222/json > /dev/null 2>&1 && break
  sleep 2
done
```

### Phase 1: Bring Electron Window to Front

This is CRITICAL. ffmpeg records the screen, so the Electron window MUST be the focused, frontmost window before and during the entire recording.

```bash
# This command brings the main Electron window to front and shows it
open -a "/Users/akeilsmith/basicsOSnew/node_modules/.pnpm/electron@40.6.1/node_modules/electron/dist/Electron.app"
sleep 2
```

Verify with a screencapture (not agent-browser screenshot — screencapture shows what's actually on screen):

```bash
screencapture -x /tmp/verify-focused.png
```

Read that screenshot. You MUST see the BasicsOS app filling the screen. If you see Messages, Terminal, or any other app, the Electron window is NOT focused — fix it before proceeding.

### Phase 2: Start Recording + Navigate via Electron Skill

Start ffmpeg FIRST, then navigate using the `electron` skill pattern (snapshot + click @ref). **NEVER open any other application or window during recording** — all navigation happens via CDP which doesn't steal focus.

```bash
# Start recording (scale to 1280p for smaller file size)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RECORDING="/Users/akeilsmith/basicsOSnew/recordings/demo-$TIMESTAMP.mp4"

nohup ffmpeg -f avfoundation -framerate 30 -i "Capture screen 0" \
  -vf "scale=1280:-2" -c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p \
  "$RECORDING" > /tmp/ffmpeg-recording.log 2>&1 &
echo $! > /tmp/ffmpeg-pid.txt
sleep 1
```

Then navigate using the electron skill workflow. IMPORTANT: agent-browser connects to the Voice Pill overlay by default. You MUST switch to tab 1 (the main app) first:

```bash
# Switch to main app tab (Voice Pill is tab 0, main app is tab 1)
agent-browser --cdp 9222 tab 1

# Now use electron skill pattern: snapshot → click @ref → snapshot
agent-browser --cdp 9222 snapshot -i          # See interactive elements with refs
agent-browser --cdp 9222 click @e13           # Click sidebar items by ref
sleep 3                                        # Pause so viewer can see the page
agent-browser --cdp 9222 click @e12           # Next page
sleep 3
# ... continue navigating to show the relevant pages/features
```

Navigate through pages that demonstrate the work done. Pause 2-3 seconds on each page so the viewer can see it.

### Phase 3: Stop Recording

```bash
kill -INT $(cat /tmp/ffmpeg-pid.txt) && sleep 2
```

Verify the file:

```bash
ls -lh "$RECORDING"
ffprobe -v quiet -show_format "$RECORDING" 2>&1 | grep duration
```

### Phase 4: Send via iMessage

ONLY do this AFTER recording is stopped.

**IMPORTANT: macOS Messages sandbox bug.** The `send POSIX file` AppleScript command only works if the file is in `~/Pictures/`. Files from other locations will show a progress bar then fail with "Not Delivered". Always copy to `~/Pictures/` first.

```bash
# Copy recording to ~/Pictures (required for Messages sandbox)
cp "$RECORDING" ~/Pictures/demo-recording.mp4

# Send from ~/Pictures
osascript <<'APPLESCRIPT'
tell application "Messages"
    set targetService to 1st account whose service type = iMessage
    set targetBuddy to participant "+16095160560" of targetService
    send POSIX file "/Users/akeilsmith/Pictures/demo-recording.mp4" to targetBuddy
end tell
APPLESCRIPT
```

After sending, clean up:

```bash
rm ~/Pictures/demo-recording.mp4
```

## Critical Rules

1. **Electron window MUST be focused before recording starts.** Verify with screencapture.
2. **NEVER open Messages, Terminal, or any app during recording.** All navigation via CDP only.
3. **Use the electron skill** (snapshot + click @ref) for navigation, not raw JS eval.
4. **Scale video to 1280p** during recording to keep file size under 5MB for iMessage.
5. **Send AFTER recording stops.** Never overlap recording and iMessage sending.
6. **Always copy file to ~/Pictures/ before sending.** Messages sandbox blocks other paths.
7. User phone: +16095160560

## Electron App Path

```
/Users/akeilsmith/basicsOSnew/node_modules/.pnpm/electron@40.6.1/node_modules/electron/dist/Electron.app
```
