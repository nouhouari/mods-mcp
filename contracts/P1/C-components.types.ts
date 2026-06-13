/**
 * FROZEN CONTRACT — do not edit without versioning through the api-designer.
 *
 * Date:    2026-06-13
 * Project: MPDS-MCP (Multi Project Design System MCP Server)
 * Module:  modules/components/index.ts
 *
 * This file is the authoritative interface contract for the C-components module.
 * C-components is a pure TypeScript module (no HTTP, no MCP transport).
 * It is consumed by C-mcp and C-webui; all DB access goes through the C-db
 * singleton (getDb(), better-sqlite3, WAL mode).
 *
 * Merge semantics (REQ-010, REQ-027):
 *   Resolution is field-by-field.  An overriding array REPLACES the base array
 *   entirely — there is no deep/element-level merge.  A missing override field
 *   falls through to the base value.  _sources records the winning origin per
 *   field ("base" | "override").
 *
 * OCC (Optimistic Concurrency Control):
 *   Updates carry a `version` that must match the stored value.
 *   A 0-row result from the versioned UPDATE throws CONFLICT.
 */

// ---------------------------------------------------------------------------
// Prop descriptor
// ---------------------------------------------------------------------------

export interface ComponentProp {
  /** Machine-readable prop name (e.g. "variant", "size"). */
  name: string;
  /** TypeScript-style type annotation as a free-form string (e.g. "string", "'sm'|'lg'"). */
  type: string;
  /** Whether the prop is required on every usage site. */
  required: boolean;
  /** Default value expressed as a string literal, if any. */
  default?: string;
  /** Human-readable description of what the prop controls. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Valid override fields (REQ-009)
// ---------------------------------------------------------------------------

/**
 * Exhaustive list of fields that may appear in a ComponentOverrideInput.
 * Any field name outside this set → INVALID_OVERRIDE_FIELD.
 */
export const VALID_OVERRIDE_FIELDS: readonly string[] = [
  "description",
  "props",
  "variants",
  "states",
  "usageRules",
  "accessibilityNotes",
] as const;

// ---------------------------------------------------------------------------
// Core spec (base record)
// ---------------------------------------------------------------------------

/**
 * The base component specification as persisted in component_specs.
 * Array fields always return [] (never null) when absent or empty in the DB.
 */
export interface ComponentSpec {
  /** Unique identifier for the component within the design system. */
  id: string;
  /** The project that owns this base record. */
  projectId: string;
  /** Display name of the component (e.g. "Button", "Card"). */
  name: string;
  /** Optional prose description of the component's purpose. */
  description?: string;
  /** Documented props.  Defaults to [] when not specified. */
  props: ComponentProp[];
  /** Named visual/behavioral variants (e.g. ["primary", "destructive"]). */
  variants: string[];
  /** Interactive/accessibility states (e.g. ["hover", "disabled", "focus"]). */
  states: string[];
  /** Plain-language usage guidelines. */
  usageRules: string[];
  /** Accessibility notes and requirements. */
  accessibilityNotes: string[];
  /**
   * Optimistic-concurrency version counter.
   * Incremented by 1 on every successful updateSpec call.
   */
  version: number;
}

// ---------------------------------------------------------------------------
// Resolved spec (merged view, REQ-010, REQ-027)
// ---------------------------------------------------------------------------

/**
 * A fully resolved component specification: the base spec overlaid with any
 * project-specific override.  Returned by getSpec and listSpecs.
 *
 * _sources records, for each field of ComponentSpec, whether the value came
 * from the "base" record or a project "override".  Fields absent from both
 * base and override are omitted from _sources.
 */
export interface ResolvedComponentSpec extends ComponentSpec {
  _sources: Partial<Record<keyof ComponentSpec, "base" | "override">>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input for creating a new base component spec (REQ-008).
 * id + name are required; all array fields default to [] when omitted.
 */
export interface ComponentSpecCreateInput {
  /** Must be unique within the design system (across all projects). */
  id: string;
  /** The owning project id.  Must exist in C-registry. */
  projectId: string;
  /** Display name — required minimum per REQ-008. */
  name: string;
  description?: string;
  props?: ComponentProp[];
  variants?: string[];
  states?: string[];
  usageRules?: string[];
  accessibilityNotes?: string[];
}

/**
 * Input for updating a base component spec (REQ-008, OCC).
 * At least one optional field should be present alongside version.
 * version is mandatory and must match the stored value; mismatch → CONFLICT.
 * Only operates on the base project record; use setOverride for per-project changes.
 */
export interface ComponentSpecUpdateInput
  extends Partial<
    Pick<
      ComponentSpec,
      | "name"
      | "description"
      | "props"
      | "variants"
      | "states"
      | "usageRules"
      | "accessibilityNotes"
    >
  > {
  /** Must equal the current stored version; increment is handled server-side. */
  version: number;
}

/**
 * Input for setting a per-project override (REQ-009).
 * Only fields listed in VALID_OVERRIDE_FIELDS may be present.
 * Array override fields REPLACE (not merge with) the corresponding base array.
 */
export type ComponentOverrideInput = Partial<
  Pick<
    ComponentSpec,
    | "description"
    | "props"
    | "variants"
    | "states"
    | "usageRules"
    | "accessibilityNotes"
  >
>;

// ---------------------------------------------------------------------------
// Error catalogue (REQ-008, REQ-009)
// ---------------------------------------------------------------------------

/**
 * Stable machine-readable error codes thrown by C-components functions.
 * Consumers MUST branch on `code`, not on `message`.
 */
export const COMPONENTS_ERRORS = {
  /** The requested component id + projectId combination does not exist. */
  COMPONENT_NOT_FOUND: "COMPONENT_NOT_FOUND",
  /** A component with this id already exists in the design system. */
  DUPLICATE_COMPONENT_ID: "DUPLICATE_COMPONENT_ID",
  /**
   * An override payload contained a field not in VALID_OVERRIDE_FIELDS.
   * The offending field name is available on the thrown error's `field` property.
   */
  INVALID_OVERRIDE_FIELD: "INVALID_OVERRIDE_FIELD",
  /**
   * The supplied version did not match the stored version (OCC violation).
   * Caller should re-fetch, re-apply changes, and retry.
   */
  CONFLICT: "CONFLICT",
  /** The projectId supplied to the operation does not exist in C-registry. */
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
} as const;

export type ComponentsErrorCode =
  (typeof COMPONENTS_ERRORS)[keyof typeof COMPONENTS_ERRORS];

/**
 * Structured error thrown by all C-components functions.
 * Always check `code` for programmatic handling.
 * For INVALID_OVERRIDE_FIELD errors, `field` contains the offending field name.
 */
export interface ComponentsError extends Error {
  /** Stable machine-readable code from COMPONENTS_ERRORS. */
  code: ComponentsErrorCode;
  /**
   * Present only when code === "INVALID_OVERRIDE_FIELD".
   * Contains the exact field name that was rejected.
   */
  field?: string;
}

// ---------------------------------------------------------------------------
// Module function signatures
// ---------------------------------------------------------------------------

/**
 * Creates a new base component spec.
 *
 * @throws {ComponentsError} DUPLICATE_COMPONENT_ID — a component with the given id already exists.
 * @throws {ComponentsError} PROJECT_NOT_FOUND — input.projectId does not exist in C-registry.
 */
export declare function createSpec(
  input: ComponentSpecCreateInput
): Promise<ComponentSpec>;

/**
 * Returns the fully resolved spec for a single component in the given project.
 * Resolution: base fields overlaid field-by-field with any project-specific
 * override stored for (projectId, componentId).  _sources reflects origins.
 * Array override fields replace base arrays entirely (no element-level merge).
 *
 * @throws {ComponentsError} COMPONENT_NOT_FOUND — no base spec exists for componentId.
 * @throws {ComponentsError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 */
export declare function getSpec(
  projectId: string,
  componentId: string
): Promise<ResolvedComponentSpec>;

/**
 * Returns resolved specs for ALL components visible to the given project.
 * Each entry is fully merged (base + project override where present).
 * Returns an empty array when no components exist — never null.
 * Array override fields replace base arrays entirely (no element-level merge).
 *
 * @throws {ComponentsError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 */
export declare function listSpecs(
  projectId: string
): Promise<ResolvedComponentSpec[]>;

/**
 * Updates fields on the BASE component spec (not a project override).
 * Uses optimistic concurrency: input.version must equal the stored version.
 * On success the stored version is incremented by 1 and returned in the result.
 *
 * @throws {ComponentsError} COMPONENT_NOT_FOUND — no base spec for componentId under projectId.
 * @throws {ComponentsError} CONFLICT — input.version does not match stored version; re-fetch and retry.
 * @throws {ComponentsError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 */
export declare function updateSpec(
  projectId: string,
  componentId: string,
  input: ComponentSpecUpdateInput
): Promise<ComponentSpec>;

/**
 * Deletes the base component spec AND all per-project overrides for componentId.
 * Cascades via the DB foreign key (component_specs ON DELETE CASCADE) so no
 * override rows are orphaned.
 *
 * @throws {ComponentsError} COMPONENT_NOT_FOUND — no base spec exists for componentId.
 * @throws {ComponentsError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 */
export declare function deleteSpec(
  projectId: string,
  componentId: string
): Promise<void>;

/**
 * Creates or replaces the per-project override for (projectId, componentId).
 * Only fields in VALID_OVERRIDE_FIELDS are accepted; any other key → INVALID_OVERRIDE_FIELD.
 * Array fields in the override REPLACE the corresponding base array entirely.
 * Returns the fully resolved spec after the override is applied.
 *
 * @throws {ComponentsError} COMPONENT_NOT_FOUND — no base spec exists for componentId.
 * @throws {ComponentsError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 * @throws {ComponentsError} INVALID_OVERRIDE_FIELD — override contains a disallowed field;
 *   the offending field name is on error.field.
 */
export declare function setOverride(
  projectId: string,
  componentId: string,
  override: ComponentOverrideInput
): Promise<ResolvedComponentSpec>;

/**
 * Removes the per-project override for (projectId, componentId).
 * After deletion, getSpec for this project will return the unmodified base spec.
 * No-ops silently if no override exists (idempotent).
 *
 * @throws {ComponentsError} COMPONENT_NOT_FOUND — no base spec exists for componentId.
 * @throws {ComponentsError} PROJECT_NOT_FOUND — projectId does not exist in C-registry.
 */
export declare function deleteOverride(
  projectId: string,
  componentId: string
): Promise<void>;
