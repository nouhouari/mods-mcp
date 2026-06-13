# C-components

A pure TypeScript module implementing the **Component Spec Catalog** for the MPDS-MCP system. C-components manages base component specifications and per-project overrides, with optimistic concurrency control (OCC) and field-by-field merge semantics.

## Overview

C-components is a TypeScript library module (no HTTP server, no MCP transport). It provides seven core functions for creating, reading, updating, and deleting component specifications in the design system. The module is consumed by C-mcp (the MCP server) and C-webui (the web UI).

**Key features:**
- **Base specs + per-project overrides**: Define a component once, then customize it per project using field-level overrides.
- **Field-by-field merge**: Unset override fields fall through to the base value. Array fields are replaced entirely (no deep merge).
- **_sources tracking**: Every resolved spec reports the origin ("base" or "override") of each field.
- **Optimistic concurrency**: `updateSpec` requires a version number; stale writes are rejected with a `CONFLICT` error.
- **Cascading delete**: Removing a base spec deletes all per-project overrides.
- **Database**: All state is persisted via the C-db singleton (better-sqlite3, WAL mode).

## API Reference

### createSpec(input)

Creates a new base component specification.

```typescript
createSpec(input: ComponentSpecCreateInput): Promise<ComponentSpec>
```

**Parameters:**
- `input.id` (string, required) — Unique component identifier within the design system.
- `input.projectId` (string, required) — The owning project (must exist in C-registry).
- `input.name` (string, required) — Display name (e.g., "Button", "Card").
- `input.description?` (string) — Optional prose description of the component's purpose.
- `input.props?` (ComponentProp[]) — Documented props; defaults to [].
- `input.variants?` (string[]) — Named visual/behavioral variants; defaults to [].
- `input.states?` (string[]) — Interactive/accessibility states; defaults to [].
- `input.usageRules?` (string[]) — Plain-language usage guidelines; defaults to [].
- `input.accessibilityNotes?` (string[]) — Accessibility notes and requirements; defaults to [].

**Returns:**
A `ComponentSpec` object with `version: 0`.

**Errors:**
- `DUPLICATE_COMPONENT_ID` — A component with this id already exists in the design system.
- `PROJECT_NOT_FOUND` — The supplied projectId does not exist in C-registry.

### getSpec(projectId, componentId)

Returns the fully resolved specification for a single component in the given project.

```typescript
getSpec(projectId: string, componentId: string): Promise<ResolvedComponentSpec>
```

**Parameters:**
- `projectId` (string) — The requesting project.
- `componentId` (string) — The component to retrieve.

**Returns:**
A `ResolvedComponentSpec` with:
- All fields from the base spec
- Override fields applied where present
- `_sources` indicating the origin ("base" or "override") of each field

**Merge semantics:**
- Fields not in override fall through to base.
- Array fields in override replace the base array entirely (no element-level merge).
- Array fields always present in the result (defaults to [] if neither base nor override define them).

**Errors:**
- `COMPONENT_NOT_FOUND` — No base spec exists for this componentId.
- `PROJECT_NOT_FOUND` — The projectId does not exist in C-registry.

### listSpecs(projectId)

Returns resolved specs for all components visible to the given project.

```typescript
listSpecs(projectId: string): Promise<ResolvedComponentSpec[]>
```

**Parameters:**
- `projectId` (string) — The requesting project.

**Returns:**
An array of fully resolved `ResolvedComponentSpec` objects, each with base + override merged and _sources populated. Returns an empty array (never null) when no components exist.

**Errors:**
- `PROJECT_NOT_FOUND` — The projectId does not exist in C-registry.

### updateSpec(projectId, componentId, input)

Updates fields on the **base** component spec (not a per-project override) using optimistic concurrency.

```typescript
updateSpec(
  projectId: string,
  componentId: string,
  input: ComponentSpecUpdateInput
): Promise<ComponentSpec>
```

**Parameters:**
- `projectId` (string) — The requesting project (validated but does not scope the write).
- `componentId` (string) — The component to update.
- `input.version` (number, required) — Must equal the current stored version.
- `input.name?`, `input.description?`, `input.props?`, `input.variants?`, `input.states?`, `input.usageRules?`, `input.accessibilityNotes?` — Fields to update.

**Returns:**
The updated `ComponentSpec` with `version` incremented by 1.

**Concurrency control:**
The supplied `version` must match the stored version exactly. If they differ (indicating another writer has modified the spec), a `CONFLICT` is thrown. The caller should re-fetch, re-apply changes, and retry.

**Errors:**
- `COMPONENT_NOT_FOUND` — No base spec exists for this componentId.
- `CONFLICT` — The supplied version does not match the stored version (OCC violation).
- `PROJECT_NOT_FOUND` — The projectId does not exist in C-registry.

### deleteSpec(projectId, componentId)

Deletes the base component spec and cascades deletion of all per-project overrides.

```typescript
deleteSpec(projectId: string, componentId: string): Promise<void>
```

**Parameters:**
- `projectId` (string) — The requesting project (validated but does not scope the write).
- `componentId` (string) — The component to delete.

**Cascade behavior:**
All per-project override rows for this componentId are deleted via database foreign-key cascade (`ON DELETE CASCADE`). No orphaned overrides are left behind.

**Errors:**
- `COMPONENT_NOT_FOUND` — No base spec exists for this componentId.
- `PROJECT_NOT_FOUND` — The projectId does not exist in C-registry.

### setOverride(projectId, componentId, override)

Creates or replaces the per-project override for a component.

```typescript
setOverride(
  projectId: string,
  componentId: string,
  override: ComponentOverrideInput
): Promise<ResolvedComponentSpec>
```

**Parameters:**
- `projectId` (string) — The requesting (child) project.
- `componentId` (string) — The component to override.
- `override` (ComponentOverrideInput) — A partial object containing only fields in `VALID_OVERRIDE_FIELDS`:
  - `description?`, `props?`, `variants?`, `states?`, `usageRules?`, `accessibilityNotes?`

**Returns:**
The fully resolved `ResolvedComponentSpec` after the override is applied.

**Validation:**
Any field name outside `VALID_OVERRIDE_FIELDS` throws `INVALID_OVERRIDE_FIELD` with the offending field name in `error.field`.

**Merge semantics:**
- Array fields in the override **replace** the base arrays entirely (no element-level merge).
- Fields absent from the override fall through to the base value in the resolved spec.

**Errors:**
- `COMPONENT_NOT_FOUND` — No base spec exists for this componentId.
- `PROJECT_NOT_FOUND` — The projectId does not exist in C-registry.
- `INVALID_OVERRIDE_FIELD` — The override contains a disallowed field; field name is in `error.field`.

### deleteOverride(projectId, componentId)

Removes the per-project override for a component, returning future `getSpec` calls to the unmodified base.

```typescript
deleteOverride(projectId: string, componentId: string): Promise<void>
```

**Parameters:**
- `projectId` (string) — The child project whose override should be removed.
- `componentId` (string) — The component ID.

**Idempotent behavior:**
If no override exists, the function returns silently (no error).

**Errors:**
- `COMPONENT_NOT_FOUND` — No base spec exists for this componentId.
- `PROJECT_NOT_FOUND` — The projectId does not exist in C-registry.

## Types

### ComponentSpec

The base component specification as persisted in the database.

```typescript
interface ComponentSpec {
  id: string;                           // Unique identifier
  projectId: string;                    // Owning project
  name: string;                         // Display name
  description?: string;                 // Optional description
  props: ComponentProp[];                // Documented props ([] if none)
  variants: string[];                   // Variant names ([] if none)
  states: string[];                     // State names ([] if none)
  usageRules: string[];                 // Usage guidelines ([] if none)
  accessibilityNotes: string[];         // A11y notes ([] if none)
  version: number;                      // OCC version counter
}
```

### ResolvedComponentSpec

The fully merged result of base + project override.

```typescript
interface ResolvedComponentSpec extends ComponentSpec {
  _sources: Partial<Record<keyof ComponentSpec, "base" | "override">>;
}
```

The `_sources` object records the origin of each field:
- `_sources.name: "base"` — The name came from the base spec.
- `_sources.variants: "override"` — The variants were customized via a per-project override.

### ComponentProp

A documented prop on a component.

```typescript
interface ComponentProp {
  name: string;              // Machine-readable name (e.g., "variant", "size")
  type: string;              // TypeScript type annotation (e.g., "string", "'sm'|'lg'")
  required: boolean;         // Whether required on every usage site
  default?: string;          // Default value as a string literal
  description?: string;      // What the prop controls
}
```

## Error Codes

All errors thrown by C-components carry a stable machine-readable `code` property. Consumers must branch on `code`, not on message.

| Code | Meaning |
|------|---------|
| `COMPONENT_NOT_FOUND` | No base spec exists for the given componentId. |
| `DUPLICATE_COMPONENT_ID` | A component with this id already exists in the design system. |
| `INVALID_OVERRIDE_FIELD` | An override contained a field not in `VALID_OVERRIDE_FIELDS`; field name is in `error.field`. |
| `CONFLICT` | The supplied version did not match the stored version (OCC violation). Re-fetch and retry. |
| `PROJECT_NOT_FOUND` | The supplied projectId does not exist in C-registry. |

## Valid Override Fields

Only the following fields may be overridden per project:

```typescript
export const VALID_OVERRIDE_FIELDS = [
  "description",
  "props",
  "variants",
  "states",
  "usageRules",
  "accessibilityNotes",
] as const;
```

Note: `id`, `projectId`, `name`, and `version` **cannot** be overridden — attempting to do so raises `INVALID_OVERRIDE_FIELD`.

## Merge Semantics (REQ-010, REQ-027)

When resolving a component spec for a project that has a per-project override:

1. **Field-by-field resolution**: Each field is evaluated independently.
2. **Override wins where present**: If the override defines a field, its value is used.
3. **Fall-through to base**: If the override is absent for a field, the base value is used.
4. **Array replacement (not deep merge)**: When an array field (props, variants, states, usageRules, accessibilityNotes) is overridden, the entire base array is replaced by the override array. There is no element-level merge.
5. **Array defaults**: Array fields always appear in the result, defaulting to [] if neither base nor override define them.
6. **_sources tracking**: The `_sources` object records the origin ("base" or "override") of each field that is actually present.

**Example:**

```typescript
// Base spec
const base = {
  id: "Button",
  name: "Button",
  props: [{ name: "size", type: "string", required: false }],
  variants: ["primary", "secondary"],
  states: ["hover", "disabled"],
  usageRules: ["Use for primary actions"],
  accessibilityNotes: [],
};

// Project override
const override = {
  variants: ["primary", "secondary", "tertiary"],  // Replaces entire array
  usageRules: ["Use sparingly"],                   // Replaces entire array
};

// Resolved result
const resolved = {
  id: "Button",
  name: "Button",  // Not in override → from base
  props: [...],    // Not in override → from base
  variants: ["primary", "secondary", "tertiary"],  // From override (entire array replaced)
  states: ["hover", "disabled"],                   // Not in override → from base
  usageRules: ["Use sparingly"],                   // From override (entire array replaced)
  accessibilityNotes: [],                          // Not in override → from base
  _sources: {
    name: "base",
    props: "base",
    variants: "override",
    states: "base",
    usageRules: "override",
    accessibilityNotes: "base",
  },
};
```

## Optimistic Concurrency Control (OCC)

The `updateSpec` function enforces OCC to prevent lost writes in concurrent scenarios:

1. Every `ComponentSpec` carries a `version` number (starts at 0).
2. `updateSpec` requires the caller to supply the current version.
3. The update is applied only if `stored_version == supplied_version`.
4. On success, the stored version is incremented by 1.
5. If a conflict is detected (versions don't match), `CONFLICT` is thrown; the caller should:
   - Re-fetch the spec to get the new version.
   - Re-apply their changes to the fresh state.
   - Retry the update with the new version.

**Retry example:**

```typescript
let spec = await getSpec(projectId, componentId);
let updated = false;

while (!updated) {
  try {
    spec = await updateSpec(projectId, componentId, {
      version: spec.version,
      name: "Updated Button",
    });
    updated = true;
  } catch (err) {
    if (err instanceof ComponentsError && err.code === "CONFLICT") {
      spec = await getSpec(projectId, componentId);  // Re-fetch
      // Re-apply changes and retry
    } else {
      throw err;
    }
  }
}
```

## Usage Examples

### Create a base component spec

```typescript
import { createSpec } from "@mpds/components";

const button = await createSpec({
  id: "Button",
  projectId: "design-system",
  name: "Button",
  description: "Primary interactive element",
  props: [
    {
      name: "variant",
      type: "'primary' | 'secondary'",
      required: true,
      description: "Button style variant",
    },
  ],
  variants: ["primary", "secondary"],
  states: ["hover", "active", "disabled"],
  usageRules: ["Always provide clear, action-oriented labels"],
  accessibilityNotes: ["Ensure sufficient color contrast", "Support keyboard navigation"],
});

console.log(button.version); // 0
```

### Get a spec and check its origin

```typescript
import { getSpec } from "@mpds/components";

const spec = await getSpec("project-alpha", "Button");

console.log(spec.variants);           // ["primary", "secondary", "tertiary"]
console.log(spec._sources.variants);  // "override" (if customized for this project)
console.log(spec._sources.name);      // "base"
```

### Set a per-project override

```typescript
import { setOverride } from "@mpds/components";

const overridden = await setOverride("project-alpha", "Button", {
  variants: ["primary", "secondary", "tertiary"],
  usageRules: ["Use our brand colors"],
});

// The returned spec is fully resolved and includes _sources
console.log(overridden.variants);           // ["primary", "secondary", "tertiary"]
console.log(overridden._sources.variants);  // "override"
```

### Update a base spec with OCC

```typescript
import { getSpec, updateSpec, ComponentsError, COMPONENTS_ERRORS } from "@mpds/components";

let spec = await getSpec(projectId, "Button");

try {
  const updated = await updateSpec(projectId, "Button", {
    version: spec.version,
    usageRules: [...spec.usageRules, "New rule"],
  });

  console.log(`Updated to version ${updated.version}`);
} catch (err) {
  if (err instanceof ComponentsError && err.code === COMPONENTS_ERRORS.CONFLICT) {
    console.error("Concurrent update detected. Re-fetch and retry.");
  } else {
    throw err;
  }
}
```

### List all components for a project

```typescript
import { listSpecs } from "@mpds/components";

const allSpecs = await listSpecs("project-alpha");

allSpecs.forEach((spec) => {
  console.log(`${spec.name} (v${spec.version})`);
  console.log(`  Variants: ${spec._sources.variants === "override" ? "(customized)" : "(standard)"}`);
});
```

### Delete a component (cascades all overrides)

```typescript
import { deleteSpec } from "@mpds/components";

await deleteSpec(projectId, "Button");
// All per-project overrides for "Button" are also deleted
```

## Implementation Notes

- **Database connection**: C-components uses the C-db singleton (`getDb()`) to access the better-sqlite3 database in WAL mode. The database must be initialized with the `component_specs` and `projects` tables before calling any functions.
- **Project validation**: All functions validate that the `projectId` exists in C-registry before proceeding.
- **Base spec identification**: Base specs are located by finding the `component_specs` row where `component_id` matches and `project.parent_id IS NULL` (the root project). This ensures that the base spec is global across all projects.
- **Close on error**: Database connections are always closed in a `finally` block to prevent leaks, even if an error occurs.

## Related Modules

- **C-db** — Database initialization and connection pooling (better-sqlite3, WAL mode).
- **C-registry** — Project and team management.
- **C-mcp** — MCP server layer that exposes C-components functions as MCP tools.
- **C-webui** — Web interface for browsing and editing component specs.
