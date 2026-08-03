# syntax=docker/dockerfile:1.7
#
# Build context = the repository root. The app has no
# `workspace:*` dependencies, so it builds standalone without the rest of the
# monorepo. VITE_* args are baked into the bundle at build time.

# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Enable the pinned pnpm via corepack.
RUN corepack enable

# Install deps first so the layer is cached until the manifest changes.
COPY package.json ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile

COPY . .

# Build-time public config (baked into the static bundle).
ARG VITE_SENTRY_DASHBOARD_TITLE="Open Monitoring"
ARG VITE_MAP_TILE_URL_LIGHT=""
ARG VITE_MAP_TILE_URL_DARK=""
ARG VITE_MAP_TILE_ATTRIBUTION=""
ENV VITE_SENTRY_DASHBOARD_TITLE=$VITE_SENTRY_DASHBOARD_TITLE \
    VITE_MAP_TILE_URL_LIGHT=$VITE_MAP_TILE_URL_LIGHT \
    VITE_MAP_TILE_URL_DARK=$VITE_MAP_TILE_URL_DARK \
    VITE_MAP_TILE_ATTRIBUTION=$VITE_MAP_TILE_ATTRIBUTION

RUN pnpm build

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner
WORKDIR /app

# `serve` is the only runtime dependency. Install it once and clean the npm
# cache so it doesn't bloat the final image.
RUN npm install -g serve && npm cache clean --force

# Only the built static assets are needed at runtime.
COPY --from=builder /app/dist ./dist

ENV PORT=8183
EXPOSE 8183

# `-s` rewrites every unknown path to index.html so deep links like
# /watch/w1 reach the client-side router instead of 404ing.
CMD ["serve", "-s", "dist", "-l", "8183"]
