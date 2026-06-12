# syntax=docker/dockerfile:1

# ── Builder stage ──────────────────────────────────────────────────────────────
FROM node:22 AS builder

WORKDIR /build

COPY package.json package-lock.json .npmrc ./
# --ignore-scripts: the `prepare` hook runs `npm run build`, which cannot
# succeed before src/ is copied; the explicit build below covers it.
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
COPY templates/ ./templates/

RUN npm run build

# Prune devDependencies so we can copy a clean node_modules
RUN npm prune --omit=dev

# ── Runner stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# Non-root user (CIS Docker Benchmark L1)
USER node

WORKDIR /app

# Copy pruned prod node_modules and compiled output directly from builder
COPY --chown=node:node --from=builder /build/node_modules ./node_modules
COPY --chown=node:node --from=builder /build/dist ./dist
COPY --chown=node:node --from=builder /build/package.json ./package.json
# Template packs are resolved relative to the package root at runtime
# (src/templater/selector.ts) — without them `bp init` cannot scaffold.
COPY --chown=node:node --from=builder /build/templates ./templates

ENV NODE_ENV=production

# Absolute path: users mount a project and set -w to it, changing the cwd.
ENTRYPOINT ["node", "/app/dist/cli/index.js"]
CMD ["--help"]
