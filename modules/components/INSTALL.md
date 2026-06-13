# C-components Installation Guide

C-components is a pure TypeScript library module — there is no standalone HTTP server or process to start. It is a dependency of C-mcp and C-webui and is imported directly by consumers.

## Prerequisites

- **Node.js** >= 18 (supports TypeScript, async/await, Promises)
- **npm** >= 9 (or pnpm >= 8 / yarn >= 4)
- **TypeScript** >= 5.0 (for type checking)
- **better-sqlite3** >= 9.0 (peer dependency for database access)
- **C-db module** initialized and running (provides the SQLite connection and `getDb()` singleton)
- **C-registry module** available (provides project validation via `getProject()`)

## Setup

### 1. Install Dependencies

From the snapbooks root directory:

```bash
npm install
```

This installs all modules including `components`, `db`, `registry`, and `tokens`.

### 2. Initialize the Database

C-components requires the C-db module to be initialized first. The database must include the `component_specs` and `projects` tables.

```bash
# From the snapbooks root
npm run db:init  # or equivalent init script if defined
```

If no db:init script exists, consult the C-db INSTALL.md for manual schema setup.

### 3. Seed Test Data (Optional)

For local development and testing, you may want to seed the database with sample component specs:

```bash
npm run db:seed  # if available
```

Alternatively, create specs programmatically in your tests or setup fixtures.

## Running Tests

C-components is tested via the Cucumber E2E test suite in the snapbooks root.

### Run All Tests

```bash
npm test
```

This executes all feature files under `features/` using conductor-e2e (Cucumber.js).

### Run Tests in Dry-Run Mode

To parse features and check syntax without executing:

```bash
npm run test:dry-run
```

### Run a Specific Test Profile

```bash
npm run test:api
```

This runs tests tagged with the `@api` profile if available.

### Generate Test Reports

After running tests, generate an Allure report:

```bash
npm run report
```

Then open the report in your browser:

```bash
npm run report:open
```

## Using C-components in Your Code

C-components exports all functions from `modules/components/index.ts`. Import them in any TypeScript or JavaScript file:

```typescript
import {
  createSpec,
  getSpec,
  listSpecs,
  updateSpec,
  deleteSpec,
  setOverride,
  deleteOverride,
  ComponentSpec,
  ResolvedComponentSpec,
  ComponentsError,
  COMPONENTS_ERRORS,
} from "@mpds/components";
```

Or import the entire module:

```typescript
import * as components from "@mpds/components";

const spec = await components.getSpec(projectId, componentId);
```

## Database Schema

C-components assumes the following tables exist in the better-sqlite3 database:

### component_specs

Stores base and per-project override component specifications.

```sql
CREATE TABLE component_specs (
  id TEXT NOT NULL,                    -- Component ID (e.g., "Button")
  project_id TEXT NOT NULL,            -- Owning project ID
  spec_json TEXT NOT NULL,             -- JSON-serialized ComponentSpec fields
  version INTEGER NOT NULL DEFAULT 0,  -- OCC version counter
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, project_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### projects

Referenced by component_specs to validate projectId and identify base specs.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,  -- NULL for base/root project, project ID for child projects
  FOREIGN KEY (parent_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

## Environment Variables

C-components does not require environment variables. All configuration (database path, connection pooling) is handled by the C-db module.

If you need to customize the database location or WAL settings, configure them in C-db's initialization.

## Troubleshooting

### "DATABASE_LOCKED" Error

**Cause**: Multiple processes are accessing the database simultaneously without proper WAL (write-ahead logging) configuration.

**Solution**: Ensure C-db is initialized in WAL mode:

```typescript
db.pragma("journal_mode = WAL");
```

WAL should be enabled by default in C-db; verify in `modules/db/index.ts`.

### "PROJECT_NOT_FOUND" Error

**Cause**: `setOverride` or another function was called with a projectId that does not exist in the projects table.

**Solution**: Verify the project exists in C-registry before calling C-components functions.

```typescript
import { getProject } from "@mpds/registry";

try {
  await getProject(projectId);
  // Safe to call C-components functions
} catch (err) {
  console.error(`Project '${projectId}' does not exist`);
}
```

### "DUPLICATE_COMPONENT_ID" Error

**Cause**: Attempted to create a component with an id that already exists in the design system.

**Solution**: Use a unique id or update the existing component with `updateSpec`.

```typescript
try {
  const spec = await createSpec({ id: "Button", projectId, name: "Button" });
} catch (err) {
  if (err instanceof ComponentsError && err.code === COMPONENTS_ERRORS.DUPLICATE_COMPONENT_ID) {
    console.log("Component already exists; updating instead...");
    const spec = await updateSpec(projectId, "Button", { version: 0, name: "Updated Button" });
  }
}
```

### "CONFLICT" Error (OCC Violation)

**Cause**: The supplied `version` does not match the stored version in an `updateSpec` call.

**Solution**: Re-fetch the spec and retry:

```typescript
import { ComponentsError, COMPONENTS_ERRORS } from "@mpds/components";

let spec = await getSpec(projectId, componentId);
let updated = false;

while (!updated) {
  try {
    spec = await updateSpec(projectId, componentId, {
      version: spec.version,
      name: "New name",
    });
    updated = true;
  } catch (err) {
    if (err instanceof ComponentsError && err.code === COMPONENTS_ERRORS.CONFLICT) {
      spec = await getSpec(projectId, componentId);  // Re-fetch
    } else {
      throw err;
    }
  }
}
```

### "INVALID_OVERRIDE_FIELD" Error

**Cause**: `setOverride` was called with a field name not in `VALID_OVERRIDE_FIELDS`.

**Solution**: Only use valid override fields. Valid fields are:
- `description`
- `props`
- `variants`
- `states`
- `usageRules`
- `accessibilityNotes`

Fields like `id`, `projectId`, `name`, and `version` cannot be overridden.

```typescript
import { VALID_OVERRIDE_FIELDS } from "@mpds/components";

const override = {
  variants: ["custom"],
  // Incorrect: name: "Button 2",  // Invalid — not in VALID_OVERRIDE_FIELDS
};

// Correct: Use only valid fields
const override = {
  variants: ["custom"],
  description: "Customized for our brand",
};
```

## Development

### Watching Changes

If you are modifying C-components source code, set up a TypeScript watcher:

```bash
npm run watch  # if defined; otherwise use tsc --watch
```

### Building/Compiling

C-components is written in TypeScript. If a build step is required:

```bash
npm run build  # if defined
```

Otherwise, TypeScript is compiled on-the-fly by the runtime or test runner.

### Linting and Formatting

Check the root `package.json` for any linting/formatting scripts:

```bash
npm run lint   # if available
npm run format # if available
```

## Integration with C-mcp

C-mcp exposes C-components functions as MCP tools over HTTP. The C-mcp server calls these functions internally and does not require any separate setup.

For details, see the C-mcp INSTALL.md.

## Integration with C-webui

C-webui imports C-components functions directly (in server-side routes) and calls them for data fetching, updates, and deletions. No additional setup is required beyond having C-components installed.

For details, see the C-webui INSTALL.md.

## Related Modules

- **C-db** (`modules/db/`) — Database initialization, connection pooling, schema management.
- **C-registry** (`modules/registry/`) — Project and team management; project validation.
- **C-tokens** (`modules/tokens/`) — Token/variable management.
- **C-mcp** (`mcp/`) — MCP server exposing C-components as tools.
- **C-webui** (`webui/`) — Web interface for browsing and editing specs.

## Support

For issues, questions, or contributions, refer to the root README.md and the project's issue tracker (if available).
