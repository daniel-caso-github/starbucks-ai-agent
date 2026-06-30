# ============================================
# BASE STAGE - Common dependencies
# ============================================
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# ============================================
# DEVELOPMENT STAGE - Vite dev server
# ============================================
FROM base AS development

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --filter @starbucks/web...

COPY packages/web ./packages/web
COPY packages/shared ./packages/shared

WORKDIR /app/packages/web

CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================
# BUILD STAGE - Bundle for production
# ============================================
FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --filter @starbucks/web...

COPY packages/web ./packages/web
COPY packages/shared ./packages/shared

WORKDIR /app/packages/web

RUN pnpm run build

# ============================================
# PRODUCTION STAGE - Static files via nginx
# ============================================
FROM nginx:alpine AS production

COPY --from=build /app/packages/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
