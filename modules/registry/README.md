# C-registry: Project Registry Module

A pure TypeScript module that manages the design system project hierarchy. It provides CRUD operations for creating, retrieving, listing, updating, and deleting design-system projects, with support for a single level of inheritance (base projects with child project overrides).

## Public API

| Function | Signature | Description |
|----------|-----------|-------------|
| `createProject` | `(input: ProjectCreateInput) => Promise<Project>` | Create a new base or child project. Returns the created Project record. |
| `getProject` | `(id: string) => Promise<Project>` | Retrieve a single project by id. Throws `PROJECT_NOT_FOUND` if not found. |
| `listProjects` | `() => Promise<Project[]>` | List all projects ordered by creation time (ascending). Returns empty array if none exist. |
| `updateProject` | `(id: string, input: ProjectUpdateInput) => Promise<Project>` | Update a project's name. `id` and `parentId` are immutable. |
| `deleteProject` | `(id: string) => Promise<void>` | Delete a project. Fails if the project has children or tokens attached. |
| `isBase` | `(id: string) => Promise<boolean>` | Return true if the project is a base project (parentId === null). |

## Error Codes

| Error Code | Meaning | HTTP Equiv. |
|-----------|---------|------------|
| `PROJECT_NOT_FOUND` | No project with the given id exists. | 404 |
| `DUPLICATE_PROJECT_ID` | A project with the same id already exists. | 409 |
| `BASE_HAS_CHILDREN` | Cannot delete a base project that still has child projects (FK constraint). | 409 |
| `MAX_INHERITANCE_DEPTH` | Cannot create a child of a child project; only one level of inheritance is allowed. | 400 |
| `PROJECT_HAS_TOKENS` | Cannot delete a project that still has token values attached. | 409 |

## Usage Example

```typescript
import { createProject, getProject, listProjects, updateProject, deleteProject, isBase } from './modules/registry/index';

// Create a base project
const baseProject = await createProject({
  id: 'base-ds',
  name: 'Global Design System',
  // parentId omitted → creates a base project
});

// Create a child project (override layer for a specific product)
const childProject = await createProject({
  id: 'product-a-ds',
  name: 'Product A Design System',
  parentId: 'base-ds',
});

// List all projects
const all = await listProjects();
console.log(`Total projects: ${all.length}`);

// Update a project's name
const updated = await updateProject('base-ds', { name: 'Global DS v2' });
console.log(`Updated project: ${updated.name}`);

// Check if a project is a base
const isBaseDs = await isBase('base-ds');
console.log(`Is base: ${isBaseDs}`); // true

// Delete a child project (allowed if no tokens reference it)
await deleteProject('product-a-ds');
```

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_PATH` | string | `./data/mpds.db` | Path to the SQLite database file (created if not exists). Set by the `C-db` module on initialization. |

## Running Tests

The module is tested as part of the API test suite. From the repo root:

```bash
npm run test:api
```

This runs all Cucumber feature files with the `api` profile, exercising the registry module's public API via step definitions.

## Module Structure

- **Public exports**: All functions and types are exported from `modules/registry/index.ts`.
- **DB dependency**: Uses `getDb()` from `modules/db/index.ts` (better-sqlite3 in WAL mode with foreign keys enabled).
- **Error handling**: All functions throw a `RegistryError` on failure; check `.code` (not `.message`) to match error types.
- **Database contract**: Uses the `projects` table defined in `contracts/P1/C-db.schema.sql` with columns: `id`, `name`, `parent_id`, `created_at`.
