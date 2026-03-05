# BasicsOS API server (Electron app connects to this)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY packages/automations/package.json packages/automations/
COPY packages/hub/package.json packages/hub/
COPY packages/voice/package.json packages/voice/
COPY packages/mcp-viewer/package.json packages/mcp-viewer/
RUN pnpm install --frozen-lockfile

FROM base AS run
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY packages ./packages

WORKDIR /app/packages/server

EXPOSE 3001

# Set env defaults; override at runtime (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL required)
ENV NODE_ENV=production
ENV PORT=3001

CMD ["pnpm", "exec", "tsx", "src/index.ts"]
