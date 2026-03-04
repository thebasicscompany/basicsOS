# BasicsOS OSS Readiness Plan

_Last updated: March 4, 2026_

This document is a practical plan to make BasicsOS truly open-source ready with minimal friction for new users and contributors.

## 1) Executive Summary

BasicsOS already has a strong technical foundation (monorepo, clear package split, local Docker Postgres flow, lint/test/typecheck commands, and a base README). The biggest OSS blockers are not architecture; they are onboarding quality, repository trust signals, and governance consistency.

If you want this repo to be production-grade OSS while still having a commercial hosted/downloaded offer, focus on:

- First-time setup success in under 10 minutes.
- Professional OSS repo standards (accurate license ownership, maintainer docs, CI, release process).
- Clear distinction between open-source code and commercial services.

## 2) Current State Snapshot

## What is already good

- `README.md` exists and includes quick start, features, env vars, and commands.
- `LICENSE.md` exists (MIT format).
- `CODE_OF_CONDUCT.md` exists.
- Issue templates and PR template exist.
- `pnpm-workspace.yaml` and package separation are clear.
- Local DB/dev setup is straightforward (`docker compose` + Drizzle).

## Gaps that block OSS polish

- Community docs are inherited/stale:
  - `.github/CONTRIBUTING.md` references `atomic-crm` and `marmelab`.
  - Issue template environment references `atomic-crm`.
  - PR template points to old external docs.
  - Code of conduct contact email points to `contact@marmelab.com`.
- License header appears copied and does not name your org/project as copyright holder.
- No CI workflows in `.github/workflows`.
- README quality issues:
  - Some mojibake/encoding artifacts in feature bullets.
  - Missing OSS-standard sections (project status, support policy, release/versioning policy, architecture map, troubleshooting, contribution path).
- Root script drift:
  - `dev:api` points to `packages/api` (does not exist).
- No explicit roadmap/governance docs for OSS direction.

## 3) OSS Launch Criteria (Definition of Ready)

Treat these as launch gates.

- New user can clone, run, and sign in successfully using one command sequence from README.
- No stale references to previous projects/orgs.
- License + ownership is unambiguous and legally correct.
- CI enforces lint, typecheck, tests on pull requests.
- Contributing path is clear (how to run app, tests, and what quality bar is expected).
- Public issue triage expectations are documented.
- Clear line between OSS artifacts and commercial offering.

## 4) Prioritized Action Plan

## P0: Must Have Before Public OSS Push

1. Fix legal identity and license metadata.
- Update `LICENSE.md` ownership line.
- Ensure `package.json` has correct `repository`, `license`, `author`, and `homepage` metadata.
- Add `NOTICE.md` if you require trademark/brand usage guidance.

2. Replace all stale community references.
- Rewrite `.github/CONTRIBUTING.md` for BasicsOS.
- Update issue templates to reference BasicsOS versions and environment keys.
- Update PR template links to local docs.
- Replace Code of Conduct contact with your actual maintained inbox.

3. Install baseline CI.
- Add GitHub Actions for:
  - Install (`pnpm install --frozen-lockfile`)
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm test`
- Trigger on pull_request and push to main.
- Optional but helpful: matrix on Node LTS + current.

4. Make README onboarding foolproof.
- Ensure all commands are copy/paste safe.
- Include exact prerequisites (Node, pnpm, Docker versions).
- Add “Known issues” + troubleshooting for Windows/macOS/Linux.
- Add “What runs where” architecture map.

5. Remove obvious command/documentation drift.
- Fix or remove `dev:api` script pointing to missing `packages/api`.
- Verify every command in README currently works.

## P1: Strongly Recommended (first 2-4 weeks post OSS)

1. Add project governance docs.
- `MAINTAINERS.md` (who reviews/merges, escalation path).
- `SUPPORT.md` (community support boundaries, response expectations).
- `SECURITY.md` (even if separate LLM is handling details).

2. Add release/versioning clarity.
- Decide SemVer policy and support window.
- Add `CHANGELOG.md` policy (manual or automated).
- Document upgrade/migration guidance for schema changes.

3. Improve package-level discoverability.
- Add short `README.md` in each package under `packages/*`:
  - purpose
  - local dev entry points
  - dependency boundaries

4. Add `docs/` information architecture.
- `docs/getting-started.md`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/custom-fields.md`
- `docs/automations.md`
- `docs/faq.md`

## P2: Nice to Have (maturity)

- Demo dataset bootstrap script for screenshots and quick evaluation.
- One-command local bootstrap (`pnpm run setup:dev`) that checks prerequisites.
- Contributor analytics labels/automation for triage.
- Public roadmap (`ROADMAP.md`) with near-term milestones.

## 5) README Blueprint (OpenFang-Inspired, BasicsOS Version)

OpenFang-style strengths to emulate:

- Fast value proposition at top.
- Installation/startup near the top (not buried).
- Clear feature + architecture orientation.
- Explicit developer workflow and contribution path.

Recommended README section order:

1. Title + one-line value proposition.
2. Screenshot/GIF strip (optional but highly recommended).
3. Why BasicsOS (problem + differentiators).
4. Features.
5. Quick Start (local dev, minimal path).
6. Prerequisites.
7. Environment variables.
8. Monorepo/package map.
9. Common commands.
10. Troubleshooting.
11. Commercial vs OSS clarification.
12. Contributing.
13. Code of Conduct.
14. License.

## Copy-ready README skeleton

```md
# BasicsOS

Open-source CRM hub with contacts, companies, deals, tasks, notes, AI chat, automations, and optional desktop app.

## Why BasicsOS

BasicsOS is built for teams that want a flexible CRM core with customizable objects and fields, plus workflow automation and AI-assisted operations.

## Features

- Configurable CRM objects and custom fields
- Generic list/detail views with saved views, filters, and sorts
- Deals pipeline and activity workflows
- Built-in AI chat and automation builder
- REST API server (Hono + Drizzle + PostgreSQL)
- Optional Electron desktop app

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker

### 1. Install

```sh
git clone <repo-url>
cd basicsOSnew
pnpm install
```

### 2. Start database

```sh
docker compose up -d
```

### 3. Configure backend

```sh
cd packages/server
cp .env.example .env
pnpm db:migrate
pnpm db:seed
cd ../..
```

### 4. Run app + API

```sh
pnpm run dev:rest
```

Open http://localhost:5173 and log in with seeded credentials.

## Environment Variables

Document all required variables in `packages/server/.env.example` and keep this table synchronized.

## Project Structure

```text
packages/
  server/
  hub/
  automations/
  voice/
  mcp-viewer/
  shared/
src/
  components/
  hooks/
  providers/
```

## Commands

- `pnpm run dev:rest` - frontend + API
- `pnpm run dev` - frontend only
- `pnpm run dev:server` - API only
- `pnpm test` - unit tests
- `pnpm run typecheck` - TypeScript checks
- `pnpm run lint` - lint checks

## Troubleshooting

- Docker container not up
- Port collisions (5173, 3001, 5435)
- Missing env vars

## OSS and Commercial Offering

This repository contains the open-source codebase.
Commercial offerings (hosted service and/or enterprise distribution) may include managed infrastructure, support SLAs, and additional services while keeping the core repo open.

## Contributing

See `.github/CONTRIBUTING.md`.

## Code of Conduct

See `CODE_OF_CONDUCT.md`.

## License

MIT. See `LICENSE.md`.
```

## 6) Licensing Strategy for OSS + Commercial on Same Repo

Your model is valid: open core repo + paid hosted/distribution/support/services.

Recommended practical approach:

- Keep code license permissive (MIT) if ecosystem/adoption is top priority.
- Keep brand/trademark policy separate (name/logo usage restrictions in `TRADEMARKS.md` or `NOTICE.md`).
- Sell commercial value through:
  - hosted operations
  - enterprise support and SLAs
  - compliance guarantees
  - managed migrations/data ops
  - optional enterprise-only add-ons (if introduced later)

If you later need stronger protection against direct hosting competitors, evaluate source-available licenses or dual-licensing, but that changes community and contribution dynamics. For now, MIT + strong service offering is simplest.

## 7) Contributor Experience Improvements

High-impact improvements for OSS adoption:

- Add `docs/first-pr.md` with a small, reproducible starter task.
- Tag “good first issue” and “help wanted” aggressively.
- Include a local debug guide with common logs/commands.
- Define code ownership for core areas (server, automations, UI).

## 8) Release and Distribution Checklist

Before each public release:

- Verify setup from a clean machine.
- Regenerate lockfile only if intended.
- Ensure migrations are backward-compatible or documented.
- Publish release notes with upgrade steps.
- Tag release (`vX.Y.Z`) and attach changelog.

## 9) 30-Day Execution Plan

Week 1:

- Fix license/ownership metadata.
- Rewrite CONTRIBUTING + templates + CoC contact.
- Correct script/doc drift.

Week 2:

- Replace README with final OSS-focused version.
- Add CI workflow.
- Add troubleshooting and architecture docs.

Week 3:

- Add package-level READMEs.
- Add MAINTAINERS/SUPPORT docs.
- Establish labels and triage flow.

Week 4:

- Dry-run from a clean environment.
- Resolve onboarding pain points.
- Publish first OSS-ready release tag.

## 10) Immediate File-Level To-Do List

- Update `README.md`.
- Update `LICENSE.md` ownership line.
- Rewrite `.github/CONTRIBUTING.md`.
- Update `.github/ISSUE_TEMPLATE/*`.
- Update `.github/pull_request_template.md`.
- Add `.github/workflows/ci.yml`.
- Add `MAINTAINERS.md`, `SUPPORT.md`, `SECURITY.md`, `ROADMAP.md` (recommended).
- Optional: add package README files under `packages/*`.

---

If you want, next step can be implementation mode: I can apply this plan directly and produce all missing docs/templates/CI in one pass.
