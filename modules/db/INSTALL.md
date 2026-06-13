# Installation & Setup — C-db

The C-db module is part of the MPDS-MCP (Multi Project Design System MCP Server) monorepo. Follow these steps to set up and use the database persistence layer.

## Prerequisites

- **Node.js** ≥ 18
- **npm** (comes with Node.js)
- **Git**

## 1. Clone the Repository

```bash
git clone http://localhost:8929/root/snapbooks.git
cd snapbooks
```

## 2. Install Dependencies

From the repo root, install all project dependencies:

```bash
npm install
```

This installs the necessary packages, including:
- `better-sqlite3` (SQLite driver for Node.js)
- `typescript` and `ts-node` (for running TypeScript)
- `@cucumber/cucumber` and related test dependencies

## 3. Environment Setup

Copy the environment template and configure it:

```bash
cp .env.example .env
```

By default, C-db uses the database at `./data/mpds.db`. If you need a custom location, set `DB_PATH` in `.env`:

```bash
# .env
DB_PATH=/path/to/your/mpds.db
```

The database file and the `data/` directory are created automatically on first access if they do not exist.

## 4. Database Initialization

C-db handles schema migrations automatically. The database is initialized the first time `runMigrations(db)` is called, typically during test setup or application startup.

### Manual Initialization (if needed)

To initialize the database programmatically:

```typescript
import { getDb, runMigrations } from './modules/db/index';

const db = getDb();
runMigrations(db);
// Database is now ready; all tables (projects, tokens, component_specs, etc.) exist
```

### Verify Schema

To verify the schema was applied correctly, you can run a quick SQL query:

```typescript
import { getDb, runMigrations } from './modules/db/index';

const db = getDb();
runMigrations(db);

// Check that the migrations table exists
const result = db.prepare('SELECT COUNT(*) as count FROM migrations').get();
console.log(`Applied migrations: ${result.count}`);

// Check that the tokens table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(`Tables: ${tables.map(t => t.name).join(', ')}`);
```

## 5. Running Tests

To run the full test suite (which exercises all modules including C-db):

```bash
npm test              # All scenarios
npm run test:dry-run  # Validate step definitions without running
npm run test:api      # API scenarios only
```

Each test run:
1. Initializes a fresh database (via `resetDb()` in test hooks).
2. Calls `runMigrations(db)` to apply the schema.
3. Executes the test scenarios.
4. Closes the connection and reports results.

### Generate and View Test Reports

After running tests, generate and open the Allure HTML report:

```bash
npm run report       # Generate the report
npm run report:open  # Open it in your browser
```

## 6. Using C-db in Your Code

Import the database functions in your TypeScript code:

```typescript
import { getDb, runMigrations, resetDb } from './modules/db/index';

// Get the singleton connection
const db = getDb();

// Apply any pending migrations
runMigrations(db);

// Now use the connection directly or pass it to other modules
// For example, C-tokens and C-registry expect getDb() to be called:
import { createToken } from './modules/tokens/index';

const token = await createToken({
  projectId: 'base-ds',
  key: 'primary-color',
  category: 'color',
  value: '#0066FF',
  isSemantic: false,
});
```

## 7. Test Isolation with resetDb()

In test hooks, call `resetDb()` before and after each scenario to ensure database state does not leak:

```typescript
import { resetDb } from './modules/db/index';

Before(() => {
  resetDb();
  // The next getDb() call will open a fresh database connection
});

After(() => {
  resetDb();
  // Clean up for the next test
});
```

This pattern is used in the Cucumber test setup and ensures each scenario starts with a clean database.

## 8. Configuration

### Database Location

The default path is `./data/mpds.db` (relative to the current working directory). To use a different location:

- Set `DB_PATH` in `.env`, or
- Set the environment variable when running: `DB_PATH=/tmp/test.db npm test`

### Database Features

The database is configured automatically by `getDb()` with:

- **WAL mode** (Write-Ahead Logging) for concurrency and durability — multiple readers can coexist with a single writer.
- **Foreign keys enabled** to enforce referential integrity constraints on insert/update/delete.
- **5-second busy timeout** to handle concurrent access without immediate failures.

### No Additional Configuration Needed

C-db is designed to be zero-configuration for most use cases. The schema is applied automatically via migrations, and the singleton connection ensures consistent state across all modules.

## 9. Understanding the Schema

The database includes these main tables:

| Table | Purpose |
|-------|---------|
| `migrations` | Tracks applied migration versions. Managed by `runMigrations()`. |
| `projects` | Design system projects and their hierarchies. |
| `tokens` | Design tokens (color, spacing, typography, etc.) with semantic reference support. |
| `component_specs` | Component definitions stored as JSON. |
| `token_pairs` | Color pair registry for WCAG contrast validation. |
| `proposals` | Token change proposals with approval workflow. |

All write-enabled tables include a `version` column for optimistic concurrency control (OCC). See **README.md** for details on using OCC.

## 10. Adding New Migrations

To extend the schema with a new migration:

1. **Create a new file** in `modules/db/migrations/` named `NNN_description.sql` (where `NNN` is the next version number, e.g., `002_add_new_table.sql`):

   ```sql
   -- modules/db/migrations/002_add_new_table.sql
   -- Description of what this migration does
   
   CREATE TABLE IF NOT EXISTS new_table (
       id   TEXT NOT NULL PRIMARY KEY,
       name TEXT NOT NULL
   );
   ```

2. **Do not include PRAGMA statements** — `getDb()` sets those automatically.

3. **Make migrations idempotent** — use `IF NOT EXISTS` and `IF EXISTS` clauses so re-running is safe.

4. **Run tests** to apply the migration:

   ```bash
   npm test
   ```

   The migration is applied automatically the first time `runMigrations(db)` is called.

5. **Never delete or edit a migration after it has been applied** in any environment. If you need to undo a change, create a new migration that reverts it.

## Troubleshooting

### Database File Not Found

If you get a "database file not found" error:

1. Ensure `DB_PATH` is set correctly (or use the default `./data/mpds.db`).
2. Verify the parent directory exists and is writable. Create it if needed:
   ```bash
   mkdir -p ./data
   ```
3. Run a test to trigger initialization: `npm test`

### Module Not Found: better-sqlite3

If you see an error like "Cannot find module 'better-sqlite3'":

1. Ensure dependencies are installed: `npm install`
2. Check that `better-sqlite3` is in `package.json` under dependencies.
3. On macOS with an M1/M2 chip, `better-sqlite3` may require compilation. Ensure Xcode command-line tools are installed:
   ```bash
   xcode-select --install
   ```

### Migrations Not Applying

If migrations are not being applied:

1. Verify the `modules/db/migrations/` directory exists.
2. Check that migration files are named correctly (e.g., `001_initial_schema.sql`, `002_next.sql`).
3. Inspect the `migrations` table to see which versions have been applied:
   ```bash
   npx tsx -e "
   import { getDb, runMigrations } from './modules/db/index';
   const db = getDb();
   runMigrations(db);
   const applied = db.prepare('SELECT version, applied_at FROM migrations ORDER BY version').all();
   console.log(applied);
   "
   ```

### Database Locked

If you see "database is locked" errors:

1. Ensure no other processes have the database open.
2. The `busy_timeout` pragma is set to 5 seconds; if the database is locked longer than that, the operation will fail.
3. In development, you can reset the database: `resetDb()` in test hooks closes any open connections.

### TypeScript Module Resolution

If you see module resolution errors, ensure `tsconfig.json` is in the repo root and contains paths for `@db`, `@registry`, `@tokens`, etc. The Cucumber test setup handles this via `tsconfig-paths`.

## Next Steps

- Review the **README.md** for API documentation and usage examples.
- Read **contracts/P1/C-db.schema.sql** for the complete schema contract.
- Check **modules/db/migrations/** for existing migrations.
- Explore **features/** directory for Cucumber scenarios that exercise the database layer.
- Review **modules/tokens/** and **modules/registry/** to see how other modules use C-db's `getDb()` function.
