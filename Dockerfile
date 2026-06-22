FROM node:20-alpine

# Native build tools required by better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install deps (including devDeps for tsx runtime)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Non-root user with a writable data directory
RUN addgroup -S mpds && adduser -S mpds -G mpds \
    && mkdir -p /home/mpds/data && chown mpds:mpds /home/mpds/data

USER mpds

VOLUME ["/home/mpds/data"]

ENV MCP_PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${MCP_PORT}/health || exit 1

CMD ["node_modules/.bin/tsx", "modules/mcp-server/src/index.ts"]
