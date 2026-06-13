// =============================================================================
// FROZEN CONTRACT — DO NOT EDIT WITHOUT VERSIONING
// File:    contracts/P1/C-registry.types.ts
// Project: MPDS-MCP (Multi Project Design System MCP Server)
// Date:    2026-06-13
// Status:  FROZEN — builders implement against this interface; changes must be
//          re-frozen and reviewed before merging.
// =============================================================================

/**
 * C-registry module contract.
 *
 * Module path:  modules/registry/index.ts
 * Dependencies: C-db — accessed exclusively via `getDb()` (better-sqlite3,
 *               WAL mode). C-registry never opens the SQLite file directly.
 * HTTP exposure: NONE — this is a pure TypeScript module. It is consumed by:
 *   - C-mcp  (MCP tool handlers that expose registry operations to LLM clients)
 *   - C-webui (web UI backend that calls registry functions server-side)
 *
 * DB column mapping note:
 *   The `projects` table uses snake_case columns. Callers always use camelCase:
 *     parent_id (DB)  <-> parentId (TypeScript)
 *     created_at (DB) <-> createdAt (TypeScript)
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/**
 * All error codes emitted by C-registry. Callers MUST match on `.code`, not
 * `.message` — message text is not part of the contract and may change.
 */
export const REGISTRY_ERRORS = {
  /** No project with the given id exists. Surfaces as HTTP-equivalent 404. */
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",

  /** A project with the same id already exists. Surfaces as HTTP-equivalent 409. */
  DUPLICATE_PROJECT_ID: "DUPLICATE_PROJECT_ID",

  /**
   * Attempted to delete a base project (parentId === null) that still has
   * child projects. Enforced by FOREIGN KEY ON DELETE RESTRICT on the DB;
   * C-registry catches the FK violation and re-surfaces it as this code.
   * HTTP-equivalent: 409 Conflict.
   */
  BASE_HAS_CHILDREN: "BASE_HAS_CHILDREN",

  /**
   * Attempted to create a project whose parentId itself already has a parent
   * (grandchild). Only one level of inheritance is allowed (child -> base).
   * HTTP-equivalent: 400 Bad Request.
   */
  MAX_INHERITANCE_DEPTH: "MAX_INHERITANCE_DEPTH",

  /**
   * Attempted to delete a project that still has token values attached.
   * Enforced at the C-db FK level; included here so callers can handle the
   * code explicitly. The token tables' FK ON DELETE RESTRICT produces this.
   * HTTP-equivalent: 409 Conflict.
   */
  PROJECT_HAS_TOKENS: "PROJECT_HAS_TOKENS",
} as const;

export type RegistryErrorCode =
  (typeof REGISTRY_ERRORS)[keyof typeof REGISTRY_ERRORS];

/**
 * Typed error thrown by all C-registry functions.
 * Consumers should check `err instanceof RegistryError` before reading `.code`.
 */
export interface RegistryError extends Error {
  code: RegistryErrorCode;
}

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

/**
 * A design-system project record as returned by C-registry.
 *
 * - Base project:  parentId === null  (the org-wide BASE design system)
 * - Child project: parentId === <id of base project>  (per-project OVERRIDE layer)
 *
 * Inheritance depth is strictly limited to one level.
 */
export interface Project {
  /** Stable, unique identifier — caller-supplied on creation. */
  id: string;

  /** Human-readable display name. */
  name: string;

  /**
   * Parent project id. null for base projects.
   * Maps to `parent_id` in the `projects` DB table.
   */
  parentId: string | null;

  /**
   * ISO-8601 UTC timestamp set on creation, never mutated.
   * Maps to `created_at` in the `projects` DB table.
   */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input for creating a new project.
 *
 * - Omitting `parentId` (or passing null/undefined) creates a base project.
 * - Supplying a `parentId` that itself has a parent raises MAX_INHERITANCE_DEPTH.
 * - Supplying an `id` that already exists raises DUPLICATE_PROJECT_ID.
 */
export interface ProjectCreateInput {
  /** Caller-chosen stable identifier. Must be unique across all projects. */
  id: string;

  /** Human-readable display name. Must be non-empty. */
  name: string;

  /**
   * Parent project id. Omit or pass null to create a base project.
   * The referenced parent must exist; otherwise PROJECT_NOT_FOUND is raised.
   */
  parentId?: string | null;
}

/**
 * Partial update input for an existing project.
 *
 * P1 constraint: only `name` is updatable. `id` and `parentId` are immutable
 * after creation. `createdAt` is never mutated.
 */
export interface ProjectUpdateInput {
  /** New display name. Must be non-empty when provided. */
  name?: string;
}

// ---------------------------------------------------------------------------
// Public API — function signatures
// ---------------------------------------------------------------------------

/**
 * Create a new project.
 *
 * @throws {RegistryError} DUPLICATE_PROJECT_ID  — id already exists
 * @throws {RegistryError} PROJECT_NOT_FOUND     — parentId supplied but not found
 * @throws {RegistryError} MAX_INHERITANCE_DEPTH — parentId refers to a child project
 */
declare function createProject(input: ProjectCreateInput): Promise<Project>;

/**
 * Retrieve a single project by id.
 *
 * @throws {RegistryError} PROJECT_NOT_FOUND — no project with this id
 */
declare function getProject(id: string): Promise<Project>;

/**
 * List all projects. Returns an empty array when no projects exist.
 * Results are ordered by `created_at` ascending (stable, insertion order).
 */
declare function listProjects(): Promise<Project[]>;

/**
 * Apply a partial update to an existing project.
 *
 * @throws {RegistryError} PROJECT_NOT_FOUND — no project with this id
 */
declare function updateProject(
  id: string,
  input: ProjectUpdateInput
): Promise<Project>;

/**
 * Delete a project by id.
 *
 * Deletion is blocked (and a typed error is thrown) when:
 *   - The project has child projects   -> BASE_HAS_CHILDREN
 *   - The project has token values     -> PROJECT_HAS_TOKENS
 * Both constraints are enforced by FOREIGN KEY ON DELETE RESTRICT at the DB
 * layer; C-registry translates the raw FK violation into the appropriate code.
 *
 * @throws {RegistryError} PROJECT_NOT_FOUND  — no project with this id
 * @throws {RegistryError} BASE_HAS_CHILDREN  — project is a base with children
 * @throws {RegistryError} PROJECT_HAS_TOKENS — project has token values attached
 */
declare function deleteProject(id: string): Promise<void>;

/**
 * Return true when the project with the given id is a base project
 * (i.e. parentId === null). Convenience predicate used by C-mcp and C-webui
 * to decide whether to merge base + override layers.
 *
 * @throws {RegistryError} PROJECT_NOT_FOUND — no project with this id
 */
declare function isBase(id: string): Promise<boolean>;

export {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  isBase,
};
