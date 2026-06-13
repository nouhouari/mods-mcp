# C-db: Shared SQLite Persistence Layer

A lightweight TypeScript module providing centralized database initialization, migration management, and singleton connection pooling for the MPDS-MCP (Multi Project Design System MCP Server) project. All other modules access the SQLite database through C-db's exported API, ensuring consistent configuration and schema versioning.

## Public API

| Function | Signature | Description |
|----------|-----------|-------------|
| `getDb` | `() => Database` | Retrieve the singleton SQLite connection. Opens the database with WAL mode, foreign keys, and busy timeout configured. Returns the same instance on repeated calls. |
| `runMigrations` | `(db: Database) => void` | Apply all pending migrations from `modules/db/migrations/*.sql` in numeric order. Idempotent; already-applied migrations are skipped. Creates the `migrations` tracking table if it does not exist. |
| `resetDb` | `() => void` | Close the singleton connection and clear it from memory. Used for test isolation only; subsequent `getDb()` calls will open a fresh connection. |

## Database Configuration

When `getDb()` opens the connection, it applies the following pragmas:

| PRAGMA | Value | Purpose |
|--------|-------|---------|
| `journal_mode` | `WAL` | Write-Ahead Logging for concurrency and durability. Multiple readers can access the DB while writers are committing. |
| `foreign_keys` | `ON` | Enforce foreign key constraints to maintain referential integrity across tables. |
| `busy_timeout` | `5000` | Wait up to 5 seconds when the database is locked by another connection before returning a timeout error. |

## Schema Overview

C-db manages the following tables (defined in `modules/db/migrations/001_initial_schema.sql`):

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `migrations` | Tracks applied migration versions | `version`, `applied_at` |
| `projects` | Design system projects and hierarchies | `id`, `name`, `parent_id`, `created_at` |
| `tokens` | Design tokens organized by category (color, spacing, typography, etc.) | `id`, `project_id`, `key`, `category`, `value`, `is_semantic`, `semantic_ref`, `version` |
| `component_specs` | Component definitions and metadata | `id`, `project_id`, `spec_json`, `version` |
| `token_pairs` | Color pair registry for WCAG contrast validation | `id`, `fg_key`, `bg_key`, `project_id` |
| `proposals` | Token value change proposals with approval workflow | `id`, `project_id`, `token_key`, `proposed_value`, `status`, `version` |

All tables include indexes on frequently-queried columns (project_id, status, category, etc.) to optimize query performance.

### Optimistic Concurrency Control (OCC)

Tables that support updates (`tokens`, `component_specs`, `proposals`) include a `version` column (default 0). When writing:

```sql
UPDATE tokens SET value = ?, version = version + 1 WHERE id = ? AND version = ?;
```

If the supplied `version` does not match the current row, zero rows are updated, indicating a concurrent write. Return `CONFLICT` to the client.

### Semantic References & Triggers

The `tokens` table allows semantic tokens to reference other tokens via `semantic_ref` (non-PK self-referential). Since SQLite does not support non-PK foreign keys, two triggers enforce referential integrity:

- `tokens_semantic_ref_insert` — Before inserting a token with a semantic_ref, ensure the referenced key exists in the same project.
- `tokens_semantic_ref_update` — Before updating a token's semantic_ref, apply the same check.

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_PATH` | string | `./data/mpds.db` | Absolute or relative path to the SQLite database file. Created automatically on first access. The `data/` directory must exist or be writable. |

## Migrations

Migrations are SQL files stored in `modules/db/migrations/` and named with a numeric prefix (e.g., `001_initial_schema.sql`, `002_add_something.sql`). They are:

- **Forward-only**: Never edit or delete a migration file after it has been applied in any environment.
- **Idempotent**: Use `CREATE TABLE IF NOT EXISTS` to allow re-running without errors.
- **Auto-applied**: `runMigrations(db)` scans the directory, reads applied versions from the `migrations` table, and applies only new ones.

To add a new migration:

1. Create a file `modules/db/migrations/NNN_description.sql` where `NNN` is one higher than the last applied version.
2. Write idempotent SQL (use `IF NOT EXISTS`, `IF NOT EXISTS` on indexes/triggers).
3. Do not include `PRAGMA` statements — those are set by `getDb()`.
4. Call `runMigrations(db)` at startup (usually in test setup).

## Usage Example

```typescript
import { getDb, runMigrations, resetDb } from './modules/db/index';

// Initialize the database
const db = getDb();
runMigrations(db);

// Now the database is ready for use by other modules
// E.g., other modules call getDb() to access the same connection:
import { createToken } from './modules/tokens/index';

const token = await createToken({
  projectId: 'base-ds',
  key: 'primary-color',
  category: 'color',
  value: '#0066FF',
  isSemantic: false,
});

// In tests, reset the connection for isolation:
// resetDb();  // Closes the singleton; next getDb() opens a fresh one
```

## Test Isolation

Each test should reset the database to avoid state leaking between scenarios:

```typescript
import { resetDb } from './modules/db/index';

Before(() => {
  resetDb();
  // Next getDb() call will open a fresh database
});

After(() => {
  resetDb();
});
```

## Module Structure

- **Exports**: `getDb`, `runMigrations`, `resetDb` are all exported from `modules/db/index.ts`.
- **Singleton pattern**: `getDb()` maintains a module-level `_db` variable. If the connection is closed (detected by checking `_db.open`), it is set to `undefined` so the next call reopens it.
- **No external dependencies** (except `better-sqlite3` which is specified in the root `package.json`).
- **Migrations discovery**: Scans `modules/db/migrations/` at runtime; if the directory does not exist, `runMigrations` is a no-op.

## Error Handling

- If the database file cannot be created or accessed (e.g., directory does not exist), `getDb()` will throw an error from `better-sqlite3`.
- If a migration file contains invalid SQL, `db.exec(sql)` will throw an error describing the SQL parse failure.
- If a migration has already been applied, `runMigrations` skips it; re-running `runMigrations` is always safe.

## Contract Authority

This module is the **sole owner** of the SQLite database file. No other module opens the database directly. All external modules receive the connection via `getDb()` and must not modify the schema outside of migrations.

The frozen schema contract is defined in `contracts/P1/C-db.schema.sql` and is the authoritative source of truth for the database structure.
