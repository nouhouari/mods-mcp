# MPDS-MCP

Multi-Project Design System MCP Server — an HTTP server that exposes design tokens,
component specs, and validation utilities via a JSON REST API and an MCP JSON-RPC
endpoint. Multiple design-system projects can coexist, each with parent-child
inheritance for token resolution.

## Architecture

```
modules/
  mcp-server/   # Express HTTP server (this binary, port MCP_PORT)
  registry/     # Project CRUD (SQLite-backed)
  tokens/       # Token storage, overrides, semantic resolution
  components/   # Component spec storage and overrides
  validate/     # Color-pair + snippet validation
  db/           # Shared SQLite connection + migrations
```

## Running locally

### Prerequisites

- Node.js 20+ and npm
- A writable directory for the SQLite DB (or use `:memory:` for a transient session)

### Start (development)

```bash
npm ci
MCP_SECRET=dev DB_PATH=/tmp/mpds-dev.db MCP_PORT=3100 \
  npm --prefix modules/mcp-server run dev
```

Health check:

```bash
curl http://localhost:3100/health
# → {"status":"ok"}
```

### Start (production build)

```bash
npm ci
npm --prefix modules/mcp-server run build
MCP_SECRET=<secret> DB_PATH=/home/mpds/data/mpds.db MPDS_ENV=production \
  npm --prefix modules/mcp-server start
```

## Environment variables

| Variable     | Required             | Default       | Description                                      |
|--------------|----------------------|---------------|--------------------------------------------------|
| `MCP_SECRET` | Yes (production)     | `""` (no auth)| Bearer token — every `/api/*` request must carry it |
| `DB_PATH`    | Yes                  | —             | SQLite file path or `:memory:` (transient)        |
| `MCP_PORT`   | No                   | random port   | TCP port the server listens on                    |
| `MPDS_ENV`   | No                   | —             | Set to `production` to enforce `MCP_SECRET` check |
| `HOME`       | No (set by OS/Docker)| —             | Used for allowed DB path prefix validation        |

## API endpoints

All endpoints (except `/health`) require `Authorization: Bearer <MCP_SECRET>`.

Error envelope: `{ "error": { "code": "...", "message": "..." } }`

### Health

```
GET /health
```

### Projects

```
GET    /api/projects
POST   /api/projects           body: { id, name, parentId? }
GET    /api/projects/:id
DELETE /api/projects/:id
```

### Tokens

```
GET    /api/projects/:projectId/tokens
PUT    /api/projects/:projectId/tokens/:key     body: { value, description? }
DELETE /api/projects/:projectId/tokens/:key/override
```

### Components

```
GET    /api/projects/:projectId/components
GET    /api/projects/:projectId/components/:componentId
PUT    /api/projects/:projectId/components/:componentId/override
DELETE /api/projects/:projectId/components/:componentId/override
```

### Validation

```
POST   /api/validate/color-pair     body: { foreground, background }
```

See [`contracts/P1/`](contracts/P1/) for the full frozen OpenAPI spec.

## Running tests

Tests use an in-memory SQLite database and require no external services:

```bash
DB_PATH=:memory: MCP_SECRET=test npm test
```

## Docker

```bash
docker build -t mpds-mcp .
docker run -p 3100:3100 \
  -e MCP_SECRET=<secret> \
  -e DB_PATH=/home/mpds/data/mpds.db \
  -v $(pwd)/data:/home/mpds/data \
  mpds-mcp
```

See [`INSTALL.md`](INSTALL.md) for full setup and docker-compose instructions.
