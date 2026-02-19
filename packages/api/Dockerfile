FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies using lockfile for reproducible builds
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/api/package.json ./packages/api/
RUN bun install --frozen-lockfile

# Production runner — Bun reads TypeScript source directly, no dist/ needed
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/config ./packages/config
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/db/src ./packages/db/src
COPY packages/db/package.json ./packages/db/package.json
COPY packages/auth/src ./packages/auth/src
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/api/src ./packages/api/src
COPY packages/api/package.json ./packages/api/package.json
COPY package.json ./
EXPOSE 3001
CMD ["bun", "packages/api/src/dev.ts"]
