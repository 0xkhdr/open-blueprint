# syntax=docker/dockerfile:1

# ── Builder stage ──────────────────────────────────────────────────────────────
FROM node:22 AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

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

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["--help"]
