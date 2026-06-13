# syntax=docker/dockerfile:1

# ── builder stage ──────────────────────────────────────────────────────────────
FROM node:20.17.0-alpine3.20 AS builder

WORKDIR /app

# Install root workspace deps (shared modules live here)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy entire monorepo so shared modules (db, registry, tokens, etc.) resolve
COPY modules/ ./modules/

# Build the mcp-server module; prune devDependencies so the runtime stage
# only sees production deps (typescript, @types/* excluded from final image)
RUN npm --prefix modules/mcp-server ci --ignore-scripts && \
    npm --prefix modules/mcp-server run build && \
    npm --prefix modules/mcp-server prune --production

# ── runtime stage ──────────────────────────────────────────────────────────────
FROM node:20.17.0-alpine3.20 AS runtime

WORKDIR /app

# Create non-root user first so --chown can reference it on every COPY (D2)
RUN addgroup -S mpds && adduser -S mpds -G mpds && \
    mkdir -p /home/mpds/data && chown mpds:mpds /home/mpds/data

# Copy production deps and compiled output only
COPY --from=builder --chown=mpds:mpds /app/node_modules ./node_modules
COPY --from=builder --chown=mpds:mpds /app/modules/mcp-server/node_modules ./modules/mcp-server/node_modules
COPY --from=builder --chown=mpds:mpds /app/modules/mcp-server/dist ./modules/mcp-server/dist

# Persistent volume for the SQLite database file (D3)
VOLUME /home/mpds/data

USER mpds

EXPOSE 3100

# HEALTHCHECK — poll /health every 30 s, 3 retries before marking unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3100/health || exit 1

ENV HOME=/home/mpds
ENV PORT=3100
ENV DB_PATH=/home/mpds/data/mpds.db

CMD ["node", "modules/mcp-server/dist/index.js"]
