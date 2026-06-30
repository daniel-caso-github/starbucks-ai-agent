# ============================================
# BASE STAGE - Common dependencies
# ============================================
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# ============================================
# DEVELOPMENT STAGE - Hot reload enabled
# ============================================
FROM base AS development

# Copy workspace manifests so pnpm can resolve deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --filter @starbucks/api...

COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

WORKDIR /app/packages/api

CMD ["pnpm", "run", "start:dev"]

# ============================================
# BUILD STAGE - Compile TypeScript
# ============================================
FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --filter @starbucks/api...

COPY packages/api ./packages/api
COPY packages/shared ./packages/shared

WORKDIR /app/packages/api

RUN pnpm run build

# ============================================
# PRODUCTION STAGE - Minimal runtime
# ============================================
FROM base AS production

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --prod --frozen-lockfile --filter @starbucks/api...

COPY --from=build /app/packages/api/dist ./packages/api/dist

WORKDIR /app/packages/api

USER node

CMD ["node", "dist/main.js"]
