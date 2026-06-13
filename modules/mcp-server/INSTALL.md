# Installation Guide — MCP Server Transport (C-mcp)

Instructions for setting up and running the MCP HTTP server in local and production environments.

## Prerequisites

- **Node.js 18 or later** (`node --version`)
- **npm 9 or later** (`npm --version`)
- **Git** (for cloning the repository)

Verify installation:
```bash
node --version
npm --version
```

## Setup Steps

### 1. Clone or navigate to the repository

```bash
cd /path/to/snapbooks
```

### 2. Install dependencies

Navigate to the MCP server module and install npm packages:

```bash
cd modules/mcp-server
npm install
```

This installs the production dependencies listed in `package.json`:
- `express` — HTTP framework
- `typescript` — TypeScript compiler
- `tsx` — TypeScript execution runner for development

### 3. Verify installation

Check that the build and dev scripts are available:

```bash
npm run --list
```

Expected output shows:
- `dev` — Run with hot-reload (development)
- `start` — Run compiled binary (production)
- `build` — Compile TypeScript to JavaScript

## Running the Server

### Development (with hot-reload)

```bash
npm run dev
```

The server starts on `http://127.0.0.1:3100` by default.

Expected output:
```
MPDS-MCP listening on port 3100 [auth: disabled]
```

### Production (compiled)

First, build the TypeScript code:

```bash
npm run build
```

This compiles `src/` to `dist/` (gitignored).

Then, start the server:

```bash
npm start
```

Or, in one step:
```bash
npm run build && npm start
```

## Environment Variables

Configure behavior by setting environment variables before start. In development, create a `.env` file in the module root:

```bash
cat > .env << 'ENVEOF'
MCP_PORT=3100
MCP_SECRET=your-bearer-token-here
MPDS_ENV=development
ENVEOF
```

Then reload the shell or source it:
```bash
source .env
npm run dev
```

### Required Variables

| Variable      | Default | Env | Purpose |
|---------------|---------|-----|---------|
| `MCP_PORT`    | 3100    | dev | HTTP server port |
| `MCP_SECRET`  | (empty) | dev | Bearer token for auth (optional in dev, required in prod) |
| `MPDS_ENV`    | dev     | dev | `development` or `production`; enforces `MCP_SECRET` if prod |

In **production** (`MPDS_ENV=production`), omitting `MCP_SECRET` causes the server to exit with error code 1.

### Example: Production with Bearer Token

```bash
export MPDS_ENV=production
export MCP_PORT=3100
export MCP_SECRET=super-secret-token-do-not-commit
npm run build
npm start
```

## Health Check

Verify the server is running (no auth required):

```bash
curl http://127.0.0.1:3100/health
```

Expected response (200 OK):
```json
{"status":"ok"}
```

If the server is not running, you will see `Connection refused`.

## Database Initialization

The MCP server uses SQLite for persistent storage. The database is initialized automatically on first run. Schema migrations apply on startup.

Database location: `.requ/requ.db` (shared with the main MPDS project).

## Docker

The component ships a multi-stage `Dockerfile` (at the repository root) that produces a minimal, non-root Alpine image.

### Build the image

Run from the monorepo root (where `Dockerfile` lives):

```bash
docker build -t mpds-mcp-server:latest .
```

### Run the container

```bash
docker run \
  -e MCP_SECRET=secret-token \
  -e MPDS_ENV=production \
  -e DB_PATH=/data/mpds.db \
  -v $(pwd)/data:/data \
  -p 3100:3100 \
  mpds-mcp-server:latest
```

> `DB_PATH` is required in production — the server exits immediately if it is unset.

Health-check: `curl http://localhost:3100/health`

## Troubleshooting

### Port already in use

If port 3100 is already in use:

```bash
# Check what is using the port (macOS/Linux)
lsof -i :3100

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Or use a different port
export MCP_PORT=3101
npm run dev
```

### Authentication header missing

If you see `MISSING_AUTH_HEADER` errors when calling non-health endpoints:

Ensure all requests include the Authorization header:

```bash
curl -H "Authorization: Bearer $MCP_SECRET" http://127.0.0.1:3100/api/projects
```

### Invalid token in production

If you see `INVALID_TOKEN` errors in production:

1. Verify `MCP_SECRET` is set and matches the token in requests
2. Verify `MPDS_ENV=production` is set (not `development`)
3. Check Bearer token has no trailing/leading whitespace

### Database errors

If the server fails with database errors on startup:

1. Ensure the parent directory `.requ/` is writable
2. Delete `.requ/requ.db` to reset (loses all data)
3. Restart the server to reinitialize the database

## Related Documentation

- **README.md** — API endpoint reference and usage examples
- **User Stories** — US-040, US-015, US-024, US-025 (see README.md)
