# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MPDS-MCP** is a Multi-Project Design System MCP Server — an Express HTTP server that exposes design tokens, component specs, and validation utilities via a JSON REST API and an MCP JSON-RPC endpoint. Multiple design-system projects can coexist with parent-child inheritance for token resolution.

The codebase follows a **modular monolith architecture** with domain-isolated modules, a comprehensive BDD test suite, and a hardened Express server with security middleware, rate-limiting, and input validation.

## Architecture & Module Breakdown

### Core Structure

```
modules/
  mcp-server/        # Express server entry point (port MCP_PORT)
  registry/          # Project CRUD operations
  tokens/            # Token storage, overrides, semantic resolution
  components/        # Component spec storage and overrides
  patterns/          # Pattern library: variants, composition rules, layout guidelines
  validate/          # Color-pair and snippet validation
  db/                # Shared SQLite connection, migrations, path validation
  web-ui/            # (placeholder for future web UI)
```

### Module Pattern

Each module (except `db` and `mcp-server`) exports:
- **Error class**: e.g., `RegistryError`, `TokensError`, `PatternsError` with a `code` and optional `message`
- **Types**: Domain models matching the frozen OpenAPI contract (in `contracts/P1/` or `P2/`)
- **Public functions**: CRUD and query operations that call `getDb()` and work with better-sqlite3
- **Row mappers**: Convert DB rows to typed objects (e.g., `rowToProject()`)

### Database Layer (`modules/db/`)

- **Singleton pattern**: `getDb()` returns a shared `better-sqlite3.Database` instance
- **Lazy initialization**: DB is opened on first access; migrations run once per application lifecycle
- **Security**: DB path validated against allowed prefixes (`/tmp/`, `$HOME/`, etc.); symlink-safe via `realpathSync`
- **Pragmas**: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`
- **Migrations**: Stored in `modules/db/migrations/NNN_*.sql`, applied in numeric order, tracked in a `migrations` table

### Server Layer (`modules/mcp-server/src/index.ts`)

- **Security hardening**: Helmet CSP, rate-limiting per IP (100 req/60s), body size cap (1 MB)
- **Authentication**: `Authorization: Bearer <MCP_SECRET>` on all `/api/*` endpoints
- **Error responses**: Consistent envelope `{ error: { code: "...", message: "..." } }`
- **Route mounting**: Each domain module exposes route handlers (e.g., `handlePatternRoutes()`) mounted at `/api/...`

## Common Development Commands

### Prerequisites
- Node.js 20+, npm
- Docker (for containerized dev/test)

### Installation & Setup
```bash
npm ci                    # Install exact versions (prefer over npm install)
```

### Development
```bash
# Start dev server (auto-reloads with tsx)
MCP_SECRET=dev DB_PATH=/tmp/mpds-dev.db MCP_PORT=3100 \
  npm --prefix modules/mcp-server run dev

# Health check
curl http://localhost:3100/health
```

### Testing (BDD with Cucumber)
```bash
# Full test suite (in-memory DB, no external services)
DB_PATH=:memory: MCP_SECRET=test npm test

# Dry-run (parse features, no execution)
npm run test:dry-run

# Single profile (e.g., API tests only)
npm run test:api

# Generate Allure report
npm run report
npm run report:open
```

### Building
```bash
# Production build (compiles TypeScript to dist/)
npm --prefix modules/mcp-server run build

# Start production server
MCP_SECRET=<secret> DB_PATH=/path/to/data/mpds.db MPDS_ENV=production \
  npm --prefix modules/mcp-server start
```

### Docker
```bash
# Build image
docker build -t mpds-mcp .

# Run with volume mount for persistence
docker run -p 3100:3100 \
  -e MCP_SECRET=<secret> \
  -e DB_PATH=/home/mpds/data/mpds.db \
  -v $(pwd)/data:/home/mpds/data \
  mpds-mcp
```

## Testing & BDD Framework

### Test Structure

- **Cucumber profiles**: `cucumber.js` defines two profiles:
  - `default`: All features in `features/**/*.feature`
  - `api`: API-only features tagged `@api` in `features/api/**/*.feature`

- **Step definitions**: `step-definitions/*.steps.ts` implement Given/When/Then steps per domain
- **Support hooks**: `support/**/*.ts` sets up test lifecycle:
  - `world.ts`: Test world class with `db`, `lastResult`, HTTP response state
  - `*hooks.ts`: Framework setup (e.g., spawning MCP server, resetting DB per scenario)
  - `timeout.ts`: Sets Cucumber timeout to 30s

- **Conductor E2E framework**: Imported from `conductor-e2e` for browser automation hooks (if needed)

### Running a Single Feature
```bash
# Run one feature file (requires npx cucumber-js syntax)
DB_PATH=:memory: MCP_SECRET=test npx cucumber-js features/api/tokens-primitive-crud.feature
```

### Test Database Strategy
- Each scenario gets a unique in-memory or temporary DB at `DB_PATH` (set by `world.ts` before scenario)
- DB is reset in `Before` hook (fresh migrations run) and cleaned up in `After` hook
- This isolation prevents test pollution and allows parallel test runs

### Reporting
- `allure-cucumberjs` generates Allure test reports in `allure-results/`
- `junit` format for CI/CD pipeline integration
- Run `npm run report` to generate HTML reports, `npm run report:open` to view

## Development Patterns

### Error Handling
- Each module defines a custom Error class with a `code` property
- Errors are caught in the Express server and serialized as `{ error: { code, message } }`
- Use error codes (not HTTP status alone) to let clients distinguish failure modes

### Input Validation
- Use `better-sqlite3` prepared statements with `?` placeholders (parameterized queries)
- Validate enum values before DB operations (e.g., token type, pattern relation)
- Throw custom errors with specific codes for validation failures

### Security Considerations
- **DB path**: Always use `getDb()` which validates `DB_PATH` at startup; symlinks are resolved
- **Secrets**: `MCP_SECRET` must be set as environment variable, never committed
- **Rate-limiting**: Per-IP in-memory store; scales to single-process deployments
- **Headers**: CSP, X-Frame-Options, X-XSS-Protection applied by Helmet
- **Body size**: Capped at 1 MB to prevent DoS

### Database Patterns
- Migrations are **idempotent**: version tracking prevents re-application
- Use `db.prepare()` + `.run()` or `.get()` for queries; SQLite is synchronous
- Foreign keys are enabled; use `CASCADE` in schema for referential integrity
- Timestamps use ISO 8601 strings (`new Date().toISOString()`)

### Module Organization
When adding a new domain module:
1. Create `modules/my-module/index.ts` with exports: `MyModuleError`, types, public functions
2. Implement row mappers to convert DB rows to typed objects
3. Add migrations (if needed) to `modules/db/migrations/NNN_my_feature.sql`
4. Export route handler `handleMyModuleRoutes()` from `modules/my-module/routes.ts`
5. Mount routes in `modules/mcp-server/src/index.ts` at `/api/my-module/...`
6. Add step definitions in `step-definitions/my-module.steps.ts`
7. Add feature files in `features/api/my-feature.feature`

## Environment Variables

| Variable     | Required         | Default       | Description                         |
|--------------|------------------|---------------|-------------------------------------|
| `MCP_SECRET` | Yes (production) | "" (no auth)   | Bearer token for `/api/*` endpoints |
| `DB_PATH`    | Yes              | —             | SQLite file path or `:memory:`      |
| `MCP_PORT`   | No               | Random        | Server listening port               |
| `MPDS_ENV`   | No               | —             | Set to `production` to enforce auth |
| `HOME`       | No (set by OS)   | —             | Used for DB path allowlist          |
| `TEST_ENV`   | No               | `default`     | Conductor test environment selector |
| `API_BASE_URL` | No             | `http://localhost:3000` | API endpoint for tests  |

## API Contracts

Frozen OpenAPI specs are in `contracts/P1/` and `contracts/P2/`:
- `C-mcp.openapi.yaml`: Main MCP API endpoints
- `C-patterns.openapi.yaml`: Pattern Library endpoints (P2)
- `*.types.ts`: TypeScript types extracted from the spec
- `*.contract-summary.md`: Human-readable endpoint summaries

**Current API structure** (from README):
- GET/POST `/api/projects`
- PUT/DELETE `/api/projects/:id/tokens/:key`
- GET/PUT/DELETE `/api/projects/:id/components/:componentId/override`
- POST `/api/validate/color-pair`
- Pattern endpoints (P2): POST/GET `/api/projects/:projectId/patterns/...`

## CI/CD Pipeline (.gitlab-ci.yml)

Stages in order:
1. **test**: `npm test` with `MCP_SECRET` from CI/CD variable (never hard-coded)
2. **build**: Docker image build and push to registry
3. **scan**: Trivy vulnerability scan (exit code 1 on CRITICAL/HIGH)
4. **e2e**: Run Cucumber against running container; waits for `/health` to be ready
5. **deploy**: (Placeholder for production deployment)

## Key Principles

- **Modular but monolithic**: Each domain is separate but shares the DB and server
- **Contract-first**: APIs defined in OpenAPI before code; step definitions bind to contract
- **Immutable migrations**: DB schema changes are permanent; reversible via down-migration if needed
- **Fail-closed security**: Missing `MCP_SECRET` in production raises an error; defaults to no auth in dev
- **Single responsibility**: Each module owns its types, errors, and database operations

## Related Documentation

- `README.md`: High-level overview and quick-start
- `modules/*/INSTALL.md`: Module-specific setup and schema details
- `contracts/P1/` and `P2/`: Frozen API specs and types
- `features/api/*.feature`: BDD specifications
