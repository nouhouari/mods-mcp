# Installation & Setup — C-tokens

The C-tokens module is part of the MPDS-MCP (Multi Project Design System MCP Server) monorepo. Follow these steps to set up and use the tokens module.

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

By default, the tokens module uses the database at `./data/mpds.db`. If you need a custom location, set `DB_PATH` in `.env`:

```bash
# .env
DB_PATH=/path/to/your/mpds.db
```

The database file is created automatically on first access if it does not exist.

## 4. Database Initialization

The C-db module handles schema migrations automatically when `runMigrations(db)` is called. This is done once during test setup and ensures the `tokens` table and all related schema exist.

For manual initialization (if needed), use the provided migration function in your code:

```typescript
import { getDb, runMigrations } from './modules/db/index';

const db = getDb();
runMigrations(db);
// Now the tokens table and all related schema exist
```

## 5. Running Tests

To run the API test suite (which exercises the tokens module):

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

Import the tokens functions directly in your TypeScript code:

```typescript
import { 
  createToken, 
  getToken, 
  listTokens, 
  updateToken, 
  deleteToken, 
  resolveTokens, 
  setOverride, 
  deleteOverride,
  TOKEN_CATEGORIES 
} from './modules/tokens/index';

// Use the functions in your application or test code
const newToken = await createToken({
  projectId: 'base-ds',
  key: 'primary-color',
  category: 'color',
  value: '#0066FF',
  isSemantic: false,
});

// List all tokens in the color category
const colors = await listTokens('base-ds', 'color');
console.log(`Found ${colors.length} color tokens`);
```

## 7. Testing Interactively (REPL)

To explore the module interactively using `tsx`:

```bash
npx tsx -e "
import { getDb, runMigrations } from './modules/db/index';
import { createProject } from './modules/registry/index';
import { createToken, listTokens } from './modules/tokens/index';

const db = getDb();
runMigrations(db);

// Ensure a project exists first (tokens belong to projects)
const proj = await createProject({ id: 'test', name: 'Test Project' });

// Create a token
const token = await createToken({
  projectId: 'test',
  key: 'my-color',
  category: 'color',
  value: '#FF0000',
  isSemantic: false,
});
console.log('Created token:', token);

// List tokens
const all = await listTokens('test');
console.log('All tokens:', all);
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
- **Circular reference detection** via recursive CTE with max depth 100

### Token Categories

Tokens must belong to one of these six categories:
- `color`
- `spacing`
- `typography`
- `radius`
- `shadow`
- `breakpoint`

Use the `TOKEN_CATEGORIES` export to enumerate them programmatically.

## 9. Understanding Semantic References

Semantic tokens can reference other tokens via `semanticRef`:

```typescript
// Create a primitive token
const primary = await createToken({
  projectId: 'base-ds',
  key: 'color-primary',
  category: 'color',
  value: '#0066FF',
  isSemantic: false,
});

// Create a semantic token that references the primitive
const buttonBg = await createToken({
  projectId: 'base-ds',
  key: 'button-background',
  category: 'color',
  value: '#0066FF', // resolved at creation
  isSemantic: true,
  semanticRef: 'color-primary', // points to the primitive
});
```

Circular references are automatically detected and rejected. Reference chains are limited to 100 hops.

## 10. Understanding Optimistic Concurrency Control (OCC)

All write operations (`updateToken`, `deleteToken`, `setOverride`) use version-based OCC. You must supply the `version` field to perform an update. If the version doesn't match the current DB version, the operation throws a `CONFLICT` error and you should re-fetch the token, merge your changes, and retry:

```typescript
// Fetch the current token and version
let token = await getToken('base-ds', 'color-primary');
console.log(`Current version: ${token.version}`);

// Attempt to update
try {
  token = await updateToken('base-ds', 'color-primary', {
    version: token.version,
    value: '#FF0000',
  });
} catch (err) {
  if (err.code === 'CONFLICT') {
    // Concurrent write detected; re-fetch and retry
    token = await getToken('base-ds', 'color-primary');
    // Merge and retry
  }
}
```

## Troubleshooting

### Database File Not Found

If you get a "database file not found" error:
1. Ensure `DB_PATH` is set correctly (or use the default `./data/mpds.db`).
2. The directory must exist or be writable. Create it if needed: `mkdir -p ./data`
3. Run a test to trigger the initial schema migration.

### Project Not Found Error

Tokens belong to projects (in C-registry). If you get `PROJECT_NOT_FOUND`:
1. Ensure the project exists: `await createProject({ id: '...', name: '...' })`
2. Use the correct `projectId` when creating tokens.

### Circular Reference Detected

If you get `CIRCULAR_REFERENCE` when creating a semantic token:
1. Check that the `semanticRef` does not form a cycle with existing tokens.
2. Use the `offendingKey` field in the error to identify the problematic token.

### Version Conflict (OCC Violation)

If you get `CONFLICT` when updating a token:
1. Another process updated the token concurrently.
2. Re-fetch the token to get the current version.
3. Merge your changes and retry with the new version.

### TypeScript Module Resolution

If you see module resolution errors, ensure `tsconfig.json` is in the repo root and contains the paths for `@db`, `@registry`, `@tokens`, etc. The Cucumber test setup handles this via `tsconfig-paths`.

## Next Steps

- Review the **README.md** for API documentation and usage examples.
- Read **contracts/P1/C-tokens.types.ts** for the complete type contract.
- Check **contracts/P1/C-registry.types.ts** to understand project management (tokens belong to projects).
- Check **features/** directory for Cucumber scenarios that exercise the tokens module.
