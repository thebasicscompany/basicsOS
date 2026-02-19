FROM oven/bun:1.2-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/ui/package.json ./packages/ui/
COPY packages/api/package.json ./packages/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build workspace packages to dist/ (needed for next start at runtime)
RUN bun --filter @basicsos/shared build && \
    bun --filter @basicsos/db build && \
    bun --filter @basicsos/auth build && \
    bun --filter @basicsos/ui build && \
    bun --filter @basicsos/web build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/auth/package.json ./packages/auth/package.json
COPY --from=builder /app/packages/ui/dist ./packages/ui/dist
COPY --from=builder /app/packages/ui/package.json ./packages/ui/package.json
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
