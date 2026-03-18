# Releasing Basics Hub (Electron)

This doc explains how to cut a new release and trigger the GitHub Actions workflow that builds and publishes the Windows and macOS Electron apps.

## Prerequisites

- All changes committed on `main` (or your release branch).
- Version in root `package.json` already set to the release you want (e.g. `0.1.5`).

## Manual release steps

### 1. Bump the version (if needed)

Edit `package.json` in the project root and set `"version"` to the new release (e.g. `"0.1.5"`).

### 2. Commit the version bump

```bash
git add package.json
git commit -m "chore: bump version to 0.1.5"
```

(Or use a different commit message; the important part is having the right version in `package.json` before tagging.)

### 3. Push your branch

```bash
git push
```

### 4. Create and push a tag

The release workflow runs **only when you push a tag** that matches `v*` (e.g. `v0.1.5`). The tag must match the version in `package.json`.

```bash
# Create tag (use the same version as in package.json, with a 'v' prefix)
git tag v0.1.5

# Push the tag to trigger the release workflow
git push origin v0.1.5
```

After the tag is pushed, GitHub Actions will:

- Run the **Release** workflow (see `.github/workflows/release.yml`).
- Build the Electron app on **macOS** and **Windows** (matrix, `fail-fast: false` so one can fail without canceling the other).
- Publish artifacts to the GitHub release for that tag (e.g. installers/DMG).

### 5. (Optional) Push everything in one go

If you’ve already committed the version bump locally:

```bash
git push
git tag v0.1.5
git push origin v0.1.5
```

## Summary

| Step | Command |
|------|--------|
| Bump version | Edit `package.json` → set `"version": "0.1.x"` |
| Commit | `git add package.json && git commit -m "chore: bump version to 0.1.x"` |
| Push branch | `git push` |
| Create tag | `git tag v0.1.x` (must match version in package.json) |
| Trigger release | `git push origin v0.1.x` |

The **Release** workflow is triggered only by **pushing a tag** (`v*`), not by pushing a normal commit.

## Signed deployment for Apple (macOS)

To get **signed and notarized** macOS builds from GitHub Actions, add these repository secrets. Without them, the macOS build still runs but the app will be unsigned and Gatekeeper may block it.

### Required GitHub secrets

| Secret | Description | Required for |
|--------|-------------|--------------|
| `CSC_LINK` | Base64-encoded Developer ID Application certificate (`.p12`) | Code signing |
| `CSC_KEY_PASSWORD` | Password used when exporting the `.p12` | Code signing |
| `APPLE_ID` | Apple ID email (e.g. your@email.com) | Notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com | Notarization |
| `APPLE_TEAM_ID` | 10-character Team ID (Settings → Membership) — only if using an Apple Developer **team** | Notarization (team accounts) |

### 1. Create and export the code-signing certificate

1. In [Apple Developer](https://developer.apple.com/account) go to **Certificates, Identifiers & Profiles** → **Certificates**.
2. Create a **Developer ID Application** certificate (for distribution outside the App Store).
3. Download and install it (double-click), then open **Keychain Access**.
4. Find the certificate (e.g. "Developer ID Application: Your Name (TEAM_ID)").
5. Right‑click → **Export** → save as `.p12`, set a **strong password** (this becomes `CSC_KEY_PASSWORD`).

### 2. Add the certificate to GitHub as base64

From the repo root, run (use your actual `.p12` path):

```bash
./scripts/prepare-apple-secrets.sh /path/to/YourCertificate.p12
```

This prints the base64 for `CSC_LINK` (and copies it to the clipboard on macOS), then reminds you which secrets to add.

Or encode manually:

```bash
base64 -i YourCertificate.p12 | tr -d '\n' | pbcopy
```

- In the repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
- Name: `CSC_LINK`, Value: paste the base64 string.
- Create another secret: `CSC_KEY_PASSWORD` = the password you set when exporting the `.p12`.

### 3. Add notarization secrets

1. **App-specific password**
   - Go to [appleid.apple.com](https://appleid.apple.com) → **Sign-In and Security** → **App-Specific Passwords**.
   - Generate a new password; use it as `APPLE_APP_SPECIFIC_PASSWORD`.

2. **GitHub secrets**
   - `APPLE_ID`: the Apple ID email you use for the developer account.
   - `APPLE_APP_SPECIFIC_PASSWORD`: the app-specific password from step 1.
   - `APPLE_TEAM_ID`: only if the certificate is under a **team** — find it in [Apple Developer](https://developer.apple.com/account) → **Membership details** (10-character ID).

After saving these secrets, the next release (tag push) will produce a signed and notarized macOS build on the `macos-latest` runner.

## Electron dependency bundling (important)

The `electron.vite.config.ts` file has `externalizeDeps: false` for the main process. **Do not change this.** electron-builder does not ship `node_modules` inside `app.asar` for the main process, so every dependency must be bundled by Vite/Rollup at build time. If you set `externalizeDeps: true` (or use a partial exclude list), the packaged app will crash on launch with:

```
ERR_MODULE_NOT_FOUND: Cannot find package 'X' imported from .../app.asar/out/main/index.js
```

Only native addons that Rollup cannot bundle (like `screencapturekit-audio-capture`) should be in `rollupOptions.external`.

### Building variant DMGs locally

To build separate "Client" and "Team" DMGs (distinct names so they install side-by-side):

```bash
pnpm build:mac:client   # → dist/Basics-Hub-Client-{version}.dmg
pnpm build:mac:team     # → dist/Basics-Hub-Team-{version}.dmg
pnpm build:mac:both     # → builds both sequentially
```

These use `electron-builder.client.yml` and `electron-builder.team.yml` which override `appId`, `productName`, and `artifactName`.

## Where to find logs (installed app)

The desktop app writes **updater** logs to a file so you can debug update checks:

| OS      | Updater log file |
|---------|-------------------|
| Windows | `%USERPROFILE%\AppData\Roaming\Basics Hub\logs\updater.log` |
| macOS   | `~/Library/Application Support/Basics Hub/logs/updater.log` |
| Linux   | `~/.config/Basics Hub/logs/updater.log` |

**Windows:** Open File Explorer and paste in the address bar:
`%USERPROFILE%\AppData\Roaming\Basics Hub\logs`

Then open `updater.log`. The first line prints the exact path; later lines show update check errors (e.g. network, GitHub release not found).
