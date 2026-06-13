# Installation & Setup — C-registry

The C-registry module is part of the MPDS-MCP (Multi Project Design System MCP Server) monorepo. Follow these steps to set up and use the registry module.

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
- `better-sqlite3` (database driver)
- `typescript` and `ts-node` (for running TypeScript)
- `@cucumber/cucumber` and related test dependencies

## 3. Environment Setup

Copy the environment template and configure it:

```bash
cp .env.example .env
```

By default, the registry module uses the database at `./data/mpds.db`. If you need a custom location, set `DB_PATH` in `.env`:

```bash
# .env
DB_PATH=/path/to/your/mpds.db
```

The database file is created automatically on first access if it does not exist.

## 4. Database Initialization

The C-db module handles schema migrations automatically when `runMigrations(db)` is called. This is done once during test setup.

For manual initialization (if needed), use the provided migration function in your code:

```typescript
import { getDb, runMigrations } from './modules/db/index';

const db = getDb();
runMigrations(db);
// Now the projects table and all related schema exist
```

## 5. Running Tests

To run the API test suite (which exercises the registry module):

```bash
npm run test:api
```

This runs Cucumber scenarios tagged with the `api` profile and generates a test report in `allure-results/`.

### Generate and View Test Reports

After running tests, generate and open the Allure HTML report:

```bash
npm run report       # Generate the report
npm run report:open  # Open it in your browser
```

## 6. Using the Module in Code

Import the registry functions directly in your TypeScript code:

```typescript
import { 
  createProject, 
  getProject, 
  listProjects, 
  updateProject, 
  deleteProject, 
  isBase 
} from './modules/registry/index';

// Use the functions in your application or test code
const newProject = await createProject({
  id: 'my-project',
  name: 'My Design System',
});
```

## 7. Testing Interactively (REPL)

To explore the module interactively using `tsx`:

```bash
npx tsx -e "
import { getDb, runMigrations } from './modules/db/index';
import { createProject, listProjects } from './modules/registry/index';

const db = getDb();
runMigrations(db);

const proj = await createProject({ id: 'test', name: 'Test' });
console.log(proj);

const all = await listProjects();
console.log('All projects:', all);
"
```

## 8. Configuration

### Database Location

The default path is `./data/mpds.db` (created relative to the current working directory). To use a different location:

- Set `DB_PATH` in `.env`, or
- Set the environment variable when running: `DB_PATH=/tmp/test.db npm run test:api`

### Database Features

The database is configured with:
- **WAL mode** (Write-Ahead Logging) for concurrency and durability
- **Foreign keys enabled** to enforce referential integrity
- **5-second busy timeout** to handle concurrent access

## Troubleshooting

### Database File Not Found

If you get a "database file not found" error:
1. Ensure `DB_PATH` is set correctly (or use the default `./data/mpds.db`).
2. The directory must exist or be writable. Create it if needed: `mkdir -p ./data`
3. Run a test to trigger the initial schema migration.

### TypeScript Module Resolution

If you see module resolution errors, ensure `tsconfig.json` is in the repo root and contains the paths for `@db`, `@registry`, etc. The Cucumber test setup handles this via `tsconfig-paths`.

### Connection Issues in Concurrent Tests

The database uses a 5-second busy timeout. If tests are very slow or time out, increase the timeout by modifying `modules/db/index.ts` or set a different path per test scenario to avoid locking.

## Next Steps

- Review the **README.md** for API documentation and usage examples.
- Read **contracts/P1/C-registry.types.ts** for the complete type contract.
- Check **features/** directory for Cucumber scenarios that exercise the registry module.
