# syntax=docker/dockerfile:1

# ── builder stage ──────────────────────────────────────────────────────────────
FROM node:20.17.0-alpine3.20 AS builder

WORKDIR /app

# Install root workspace deps (shared modules live here)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy entire monorepo so shared modules (db, registry, tokens, etc.) resolve
COPY modules/ ./modules/

# Build the mcp-server module
RUN npm --prefix modules/mcp-server ci --ignore-scripts && \
    npm --prefix modules/mcp-server run build

# ── runtime stage ──────────────────────────────────────────────────────────────
FROM node:20.17.0-alpine3.20 AS runtime

WORKDIR /app

# Copy production deps and compiled output only
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/modules/mcp-server/node_modules ./modules/mcp-server/node_modules
COPY --from=builder /app/modules/mcp-server/dist ./modules/mcp-server/dist

# Copy shared compiled modules that mcp-server imports at runtime
COPY --from=builder /app/modules/db ./modules/db
COPY --from=builder /app/modules/registry ./modules/registry
COPY --from=builder /app/modules/tokens ./modules/tokens
COPY --from=builder /app/modules/components ./modules/components
COPY --from=builder /app/modules/validate ./modules/validate

# Non-root user (C4)
RUN addgroup -S mpds && adduser -S mpds -G mpds
USER mpds

EXPOSE 3100

# HEALTHCHECK — poll /health every 30 s, 3 retries before marking unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3100/health || exit 1

ENV PORT=3100

CMD ["node", "modules/mcp-server/dist/index.js"]
