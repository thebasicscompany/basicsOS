# Contributing to Basics OS

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm@9`)
- Docker (for local PostgreSQL + Redis)

### Getting Started

```bash
git clone https://github.com/your-org/basicos
cd basicos
pnpm install
cp .env.example .env
docker-compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Development Workflow

All development happens in git worktrees, not on main:

```bash
git worktree add ../basicos-feature-name -b feature/feature-name
cd ../basicos-feature-name
# implement, test, commit
cd ../basicos
git merge feature/feature-name
git worktree remove ../basicos-feature-name
```

## Code Standards

- TypeScript strict mode — no `any`
- Named exports only — no default exports
- Co-locate tests with source files (`feature.ts` + `feature.test.ts`)
- Run `pnpm typecheck && pnpm lint && pnpm test` before submitting

## Commit Format

```
type(scope): short description

- feat: new feature
- fix: bug fix
- chore: tooling/deps
- docs: documentation
- test: tests only
```

## Pull Request Process

1. Create a feature branch from main
2. Implement changes with tests
3. Run full test suite: `bun test`
4. Submit PR with description of changes and testing steps
