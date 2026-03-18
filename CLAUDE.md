@AGENTS.md

When working on backend (server, DB, API): follow @.claude/skills/backend-dev/SKILL.md
When working on frontend (components, pages, forms): follow @.claude/skills/frontend-dev/SKILL.md
For complete UI architecture reference: follow @.claude/skills/frontend-dev/UI-REFERENCE.md
When building a new feature (app, object, pill integration): follow @.claude/skills/new-feature/SKILL.md
When building pill/overlay features (voice, screen capture, Electron): follow @.claude/skills/pill-feature/SKILL.md
For gateway API, BYOK headers, or external integrations: see https://basicsos.com/api-docs

## Electron Packaging Rule

`electron.vite.config.ts` → `main.build.externalizeDeps` MUST stay `false`. Never change it. electron-builder does not ship node_modules for the main process — all deps must be bundled by Vite. Changing this causes ERR_MODULE_NOT_FOUND crashes in packaged DMGs. See AGENTS.md and RELEASE.md for details.
