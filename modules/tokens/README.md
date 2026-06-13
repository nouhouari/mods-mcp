# C-tokens: Design Token Store Module

A pure TypeScript module for managing design tokens across multiple projects with support for semantic references, project-level overrides, and optimistic concurrency control. Tokens are organized into six categories: color, spacing, typography, radius, shadow, and breakpoint.

## Public API

| Function | Signature | Description |
|----------|-----------|-------------|
| `createToken` | `(input: TokenCreateInput) => Promise<Token>` | Create a primitive or semantic token in a project. Enforces circular-reference detection. |
| `getToken` | `(projectId: string, key: string) => Promise<Token>` | Retrieve a single token by project and key. |
| `listTokens` | `(projectId: string, category?: TokenCategory) => Promise<Token[]>` | List all tokens in a project, optionally filtered by category. |
| `updateToken` | `(projectId: string, key: string, input: TokenUpdateInput) => Promise<Token>` | Partially update a token's value and/or semantic reference with OCC (Optimistic Concurrency Control). |
| `deleteToken` | `(projectId: string, key: string, version: number) => Promise<void>` | Delete a token with OCC. Fails if any semantic token references it. |
| `resolveTokens` | `(projectId: string, category?: TokenCategory) => Promise<ResolvedToken[]>` | Resolve the merged token view (base + project-level overrides), tagged with source. |
| `setOverride` | `(projectId: string, key: string, value: string, version: number) => Promise<Token>` | Create or update a project-level override for a base token. |
| `deleteOverride` | `(projectId: string, key: string) => Promise<void>` | Delete a project-level override, reverting to the base value. No-op if no override exists. |

## Token Categories

Tokens are organized into exactly these six categories:

```
color, spacing, typography, radius, shadow, breakpoint
```

Use the exported constant `TOKEN_CATEGORIES` to enumerate them in your application.

## Error Codes

| Error Code | Meaning | Additional Fields |
|-----------|---------|-------------------|
| `INVALID_CATEGORY` | The supplied category string is not in `TOKEN_CATEGORIES`. | — |
| `DUPLICATE_TOKEN_KEY` | A token with this (projectId, category, key) already exists. | — |
| `TOKEN_NOT_FOUND` | No token with the given projectId + key exists. | — |
| `TOKEN_REFERENCED_BY_SEMANTIC` | Cannot delete; at least one semantic token references this key. | `referencedBy?: string[]` |
| `CIRCULAR_REFERENCE` | A circular reference was detected in the semantic-ref chain. | `offendingKey?: string` |
| `REFERENCE_CHAIN_TOO_DEEP` | The semantic-ref chain exceeds 100 hops (recursive CTE limit). | — |
| `CONFLICT` | Optimistic concurrency violation: the supplied version did not match current DB version. | — |
| `PROJECT_NOT_FOUND` | The referenced projectId does not exist in C-registry. | — |

## Usage Example

```typescript
import { 
  createToken, 
  getToken, 
  listTokens, 
  updateToken, 
  deleteToken, 
  resolveTokens, 
  setOverride, 
  deleteOverride 
} from './modules/tokens/index';

// Create a primitive token (base color)
const primaryColor = await createToken({
  projectId: 'base-ds',
  key: 'color-primary',
  category: 'color',
  value: '#0066FF',
  isSemantic: false,
});

// Create a semantic token that references the primitive
const buttonBg = await createToken({
  projectId: 'base-ds',
  key: 'button-bg',
  category: 'color',
  value: '#0066FF', // resolved value at create time
  isSemantic: true,
  semanticRef: 'color-primary',
});

// List all color tokens in the base project
const colors = await listTokens('base-ds', 'color');
console.log(`Color tokens: ${colors.length}`);

// Create a project-level override for a specific product
const overridden = await setOverride('product-a-ds', 'color-primary', '#FF6600', 0);
console.log(`Override created with version: ${overridden.version}`);

// Resolve the merged token view (base + overrides)
const resolved = await resolveTokens('product-a-ds', 'color');
resolved.forEach(token => {
  console.log(`${token.key}: ${token.value} (source: ${token.source})`);
});

// Update a token's value with OCC
const updated = await updateToken('base-ds', 'color-primary', {
  version: 1, // Must match current version
  value: '#0055DD',
});

// Delete an override, reverting to base
await deleteOverride('product-a-ds', 'color-primary');
```

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_PATH` | string | `./data/mpds.db` | Path to the SQLite database file. Set by the `C-db` module on initialization. |

## Running Tests

The module is tested as part of the API test suite. From the repo root:

```bash
npm run test:api
```

This runs all Cucumber feature files with the `api` profile, exercising the tokens module's public API via step definitions.

## Module Structure

- **Public exports**: All functions and types are exported from `modules/tokens/index.ts`.
- **DB dependency**: Uses `getDb()` from `modules/db/index.ts` (better-sqlite3 in WAL mode with foreign keys enabled).
- **Registry dependency**: Validates project existence via `C-registry` before any token operation.
- **Error handling**: All functions throw a `TokensError` on failure; check `.code` (not `.message`) to match error types. Check optional fields like `.offendingKey` and `.referencedBy` for context.
- **Circular reference detection**: Implemented via recursive CTE (SQL `WITH RECURSIVE`), max traversal depth 100 hops.
- **Optimistic concurrency**: All write operations (`updateToken`, `deleteToken`, `setOverride`) use version checking; mismatches throw `CONFLICT`.
- **Database contract**: Uses the `tokens` table defined in `contracts/P1/C-db.schema.sql` with columns: `id`, `project_id`, `key`, `category`, `value`, `is_semantic`, `semantic_ref`, `version`.
