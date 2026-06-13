/**
 * FROZEN CONTRACT — DO NOT EDIT WITHOUT VERSION BUMP
 *
 * Project:  MPDS-MCP (Multi Project Design System MCP Server)
 * Module:   modules/tokens/index.ts
 * Contract: contracts/P1/C-tokens.types.ts
 * Frozen:   2026-06-13
 *
 * This file is the source of truth for the C-tokens module public surface.
 * C-mcp and C-webui implement against this contract in parallel.
 * Any change that removes or narrows an export is a breaking change and
 * requires a new contract version and orchestrator sign-off.
 *
 * Dependencies:
 *   - C-db  : getDb() singleton (better-sqlite3, WAL mode)
 *   - C-registry: project existence checks (see REGISTRY_ERRORS / RegistryError)
 *
 * DB backing table: tokens
 *   UNIQUE (project_id, category, key)
 *   OCC:  UPDATE … SET version=version+1 WHERE id=? AND version=?
 *         0 rows affected → throw TOKENS_ERRORS.CONFLICT
 *
 * Circular-reference detection: recursive CTE inside the same transaction,
 * max traversal depth 100; exceeding it throws REFERENCE_CHAIN_TOO_DEEP.
 */

// ---------------------------------------------------------------------------
// 1. Categories
// ---------------------------------------------------------------------------

/** Exhaustive list of allowed token categories. Mirrors the DB CHECK constraint. */
export const TOKEN_CATEGORIES = [
  'color',
  'spacing',
  'typography',
  'radius',
  'shadow',
  'breakpoint',
] as const;

/** Union type derived from TOKEN_CATEGORIES. */
export type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// 2. Raw DB record shape
// ---------------------------------------------------------------------------

/**
 * Raw token record as stored in the `tokens` table.
 * Field names are camelCase mappings of the snake_case DB columns.
 */
export interface Token {
  /** Auto-increment PK. */
  id: number;

  /** FK → projects.id (CASCADE DELETE). */
  projectId: string;

  /** Token key, unique within (projectId, category). */
  key: string;

  /** One of the six allowed categories. */
  category: TokenCategory;

  /**
   * Serialised value.
   * For primitive tokens: the literal value (e.g. "#FF0000", "8px").
   * For semantic tokens: the resolved value at read-time (implementor note:
   * always store the raw value; resolution is the job of resolveTokens).
   */
  value: string;

  /** true → semantic token; false → primitive token. */
  isSemantic: boolean;

  /**
   * Key of another token in the same project that this token references.
   * Must be null/undefined when isSemantic is false.
   * Circular-reference check is enforced by the implementation via recursive
   * CTE before any INSERT or UPDATE (not by a DB trigger or FK).
   */
  semanticRef?: string;

  /**
   * Optimistic-concurrency version counter.
   * Incremented atomically on every UPDATE by the DB:
   *   UPDATE tokens SET version = version + 1 WHERE id = ? AND version = ?
   * A 0-row result means a concurrent write won the race → CONFLICT.
   */
  version: number;
}

// ---------------------------------------------------------------------------
// 3. Resolved / merged-view shape
// ---------------------------------------------------------------------------

/**
 * A token entry in the resolved merged view (REQ-007).
 * resolveTokens returns base tokens overridden by any project-scoped override.
 * The source field tells the caller whether the value came from the base
 * project or from an override in the requested project.
 */
export interface ResolvedToken {
  key: string;
  category: TokenCategory;
  /** Effective value after override resolution. */
  value: string;
  /** "base" → value comes from the parent/base project; "override" → from this project. */
  source: 'base' | 'override';
  isSemantic: boolean;
  /**
   * Populated only for semantic tokens.
   * Refers to the key of another token in the same project (post-resolution scope).
   */
  semanticRef?: string;
}

// ---------------------------------------------------------------------------
// 4. Input types
// ---------------------------------------------------------------------------

/**
 * Input for creating a new token (REQ-004, REQ-005).
 *
 * Validation rules (enforced by implementation, not TypeScript types alone):
 *   - projectId   : must reference an existing project (checked via C-registry);
 *                   throws PROJECT_NOT_FOUND if absent.
 *   - key         : non-empty string; combined with (projectId, category) must
 *                   be unique → DUPLICATE_TOKEN_KEY on conflict.
 *   - category    : must be a member of TOKEN_CATEGORIES → INVALID_CATEGORY.
 *   - value       : non-empty string.
 *   - isSemantic  : defaults to false when omitted.
 *   - semanticRef : required when isSemantic=true; must be omitted (or undefined)
 *                   when isSemantic=false; the referenced key must exist in the
 *                   same project; circular references are rejected →
 *                   CIRCULAR_REFERENCE / REFERENCE_CHAIN_TOO_DEEP.
 */
export interface TokenCreateInput {
  projectId: string;
  key: string;
  category: TokenCategory;
  value: string;
  isSemantic?: boolean;
  semanticRef?: string;
}

/**
 * Input for updating an existing token (partial update + OCC).
 *
 * Validation rules:
 *   - version     : REQUIRED — must match the current DB version for the token;
 *                   mismatch → CONFLICT (optimistic concurrency violation).
 *   - value       : when supplied, must be a non-empty string.
 *   - semanticRef : when supplied on a semantic token, triggers a new
 *                   circular-reference check; setting to undefined/null clears
 *                   the reference (only valid when isSemantic remains true).
 *   - At least one of value or semanticRef must be provided (implementor:
 *                   reject a no-op update to avoid a spurious version bump).
 */
export interface TokenUpdateInput {
  /** Current version of the token — required for OCC. */
  version: number;
  value?: string;
  /**
   * Pass undefined to clear an existing semanticRef.
   * Ignored when the target token is not semantic (implementor: reject or ignore
   * with a warning; prefer reject for clarity).
   */
  semanticRef?: string;
}

// ---------------------------------------------------------------------------
// 5. Error catalogue
// ---------------------------------------------------------------------------

/**
 * Exhaustive set of machine-readable error codes emitted by C-tokens.
 * Implementors throw a TokensError whose .code is one of these values.
 * Consumers (C-mcp, C-webui) switch on the code — never on the message string.
 */
export const TOKENS_ERRORS = {
  /** The supplied category string is not in TOKEN_CATEGORIES. */
  INVALID_CATEGORY: 'INVALID_CATEGORY',

  /** A token with this (projectId, category, key) already exists. */
  DUPLICATE_TOKEN_KEY: 'DUPLICATE_TOKEN_KEY',

  /** No token with the given projectId + key exists. */
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',

  /**
   * The token cannot be deleted because at least one semantic token in the
   * same project references it via semanticRef.
   * The error's `referencedBy` field SHOULD name the referencing token key(s).
   */
  TOKEN_REFERENCED_BY_SEMANTIC: 'TOKEN_REFERENCED_BY_SEMANTIC',

  /**
   * A circular reference was detected in the semantic-ref chain.
   * The error's `offendingKey` field identifies the key that closes the cycle.
   */
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',

  /**
   * The semantic-ref chain exceeds 100 hops (max depth for the recursive CTE).
   * Treat as a misconfigured graph — surface to the caller; do not silently truncate.
   */
  REFERENCE_CHAIN_TOO_DEEP: 'REFERENCE_CHAIN_TOO_DEEP',

  /**
   * Optimistic concurrency conflict: the supplied version did not match the
   * current DB version at the time of UPDATE.
   * Callers SHOULD re-fetch the token, merge, and retry.
   */
  CONFLICT: 'CONFLICT',

  /**
   * The referenced projectId does not exist in C-registry.
   * Checked at the start of any operation that takes a projectId.
   */
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
} as const;

/** Union of all valid error code strings. */
export type TokensErrorCode = (typeof TOKENS_ERRORS)[keyof typeof TOKENS_ERRORS];

/**
 * Error type thrown by every C-tokens function.
 * Always check .code — never .message — in consumer logic.
 */
export interface TokensError extends Error {
  /** Machine-readable discriminant. */
  code: TokensErrorCode;

  /**
   * For CIRCULAR_REFERENCE: the key of the token that closes the cycle.
   * Undefined for all other codes.
   */
  offendingKey?: string;

  /**
   * For TOKEN_REFERENCED_BY_SEMANTIC: array of keys that reference the
   * token being deleted.
   * Undefined for all other codes.
   */
  referencedBy?: string[];
}

// ---------------------------------------------------------------------------
// 6. Public function signatures
// ---------------------------------------------------------------------------

/**
 * Create a primitive or semantic token in a project.
 *
 * @throws {TokensError} PROJECT_NOT_FOUND   — projectId does not exist in C-registry.
 * @throws {TokensError} INVALID_CATEGORY    — category is not in TOKEN_CATEGORIES.
 * @throws {TokensError} DUPLICATE_TOKEN_KEY — (projectId, category, key) already exists.
 * @throws {TokensError} TOKEN_NOT_FOUND     — semanticRef references a non-existent key.
 * @throws {TokensError} CIRCULAR_REFERENCE  — semanticRef would create a cycle; see error.offendingKey.
 * @throws {TokensError} REFERENCE_CHAIN_TOO_DEEP — chain exceeds 100 hops.
 *
 * Note: circular-reference detection runs via a recursive CTE inside the same
 * write transaction as the INSERT; the transaction is rolled back on detection.
 */
export declare function createToken(input: TokenCreateInput): Promise<Token>;

/**
 * Retrieve a single raw token by projectId + key.
 *
 * @throws {TokensError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 * @throws {TokensError} TOKEN_NOT_FOUND   — no token with this key in this project.
 */
export declare function getToken(projectId: string, key: string): Promise<Token>;

/**
 * List all raw tokens in a project, optionally filtered by category.
 * Returns an empty array (not an error) when no tokens match.
 *
 * @throws {TokensError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 * @throws {TokensError} INVALID_CATEGORY  — category argument is not in TOKEN_CATEGORIES.
 */
export declare function listTokens(projectId: string, category?: TokenCategory): Promise<Token[]>;

/**
 * Partially update a token's value and/or semanticRef with OCC.
 * The version field in input must match the current DB version; on mismatch
 * the call throws CONFLICT and the DB is not modified.
 *
 * @throws {TokensError} PROJECT_NOT_FOUND        — projectId does not exist in C-registry.
 * @throws {TokensError} TOKEN_NOT_FOUND          — token does not exist.
 * @throws {TokensError} CONFLICT                 — version mismatch (concurrent write).
 * @throws {TokensError} CIRCULAR_REFERENCE       — updated semanticRef creates a cycle; see error.offendingKey.
 * @throws {TokensError} REFERENCE_CHAIN_TOO_DEEP — chain exceeds 100 hops.
 *
 * Note: circular-reference check and the UPDATE run inside the same transaction.
 */
export declare function updateToken(
  projectId: string,
  key: string,
  input: TokenUpdateInput,
): Promise<Token>;

/**
 * Delete a token by projectId + key, with OCC via the supplied version.
 * The token must not be referenced by any semantic token in the same project.
 *
 * @throws {TokensError} PROJECT_NOT_FOUND           — projectId does not exist in C-registry.
 * @throws {TokensError} TOKEN_NOT_FOUND             — token does not exist.
 * @throws {TokensError} CONFLICT                    — version mismatch (concurrent write).
 * @throws {TokensError} TOKEN_REFERENCED_BY_SEMANTIC — at least one semantic token points to this key;
 *                                                       see error.referencedBy.
 */
export declare function deleteToken(
  projectId: string,
  key: string,
  version: number,
): Promise<void>;

/**
 * Resolve the merged token view for a project (REQ-007).
 * Returns base tokens overlaid with any project-scoped overrides.
 * Each entry is tagged source: "base" | "override".
 * Optionally filtered to a single category.
 *
 * Resolution algorithm (implementor):
 *   1. Walk the project hierarchy to find the base project (C-registry.isBase).
 *   2. SELECT all base tokens for the category (if supplied) as "base".
 *   3. SELECT all override tokens scoped to projectId.
 *   4. Merge: for each override key, replace the base entry; add override-only keys.
 *
 * Returns an empty array when no tokens exist.
 *
 * @throws {TokensError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 * @throws {TokensError} INVALID_CATEGORY  — category argument is not in TOKEN_CATEGORIES.
 */
export declare function resolveTokens(
  projectId: string,
  category?: TokenCategory,
): Promise<ResolvedToken[]>;

/**
 * Create or replace a project-level override for a base token (REQ-006).
 * The override lives in the `tokens` table scoped to projectId.
 * The base token record is never mutated.
 * Pass version=0 when no override exists yet (first-time create).
 *
 * @throws {TokensError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 * @throws {TokensError} TOKEN_NOT_FOUND   — no token with this key exists in the base project.
 * @throws {TokensError} CONFLICT          — version mismatch on an existing override.
 */
export declare function setOverride(
  projectId: string,
  key: string,
  value: string,
  version: number,
): Promise<Token>;

/**
 * Delete a project-level override, reverting the token to its base value (REQ-006).
 * No-op if no override exists for this key in this project (does not throw).
 *
 * @throws {TokensError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 */
export declare function deleteOverride(projectId: string, key: string): Promise<void>;
