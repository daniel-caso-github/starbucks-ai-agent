# ============================================
# BASE STAGE - Common dependencies
# ============================================
FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ============================================
# DEVELOPMENT STAGE - Hot reload enabled
# ============================================
FROM base AS development

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

CMD ["pnpm", "run", "start:dev"]

# ============================================
# BUILD STAGE - Compile TypeScript
# ============================================
FROM base AS build

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# ============================================
# PRODUCTION STAGE - Minimal runtime
# ============================================
FROM base AS production

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist

USER node

CMD ["node", "dist/main.js"]