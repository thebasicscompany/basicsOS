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
