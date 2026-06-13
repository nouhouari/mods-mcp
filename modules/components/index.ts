import Database from 'better-sqlite3';
import { getDb } from '../db/index';
import { getProject, RegistryError } from '../registry/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VALID_OVERRIDE_FIELDS = [
  'description',
  'props',
  'variants',
  'states',
  'usageRules',
  'accessibilityNotes',
] as const;

// ---------------------------------------------------------------------------
// Error catalogue (mirrors frozen contract)
// ---------------------------------------------------------------------------

export const COMPONENTS_ERRORS = {
  COMPONENT_NOT_FOUND: 'COMPONENT_NOT_FOUND',
  DUPLICATE_COMPONENT_ID: 'DUPLICATE_COMPONENT_ID',
  INVALID_OVERRIDE_FIELD: 'INVALID_OVERRIDE_FIELD',
  CONFLICT: 'CONFLICT',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
} as const;

export type ComponentsErrorCode = (typeof COMPONENTS_ERRORS)[keyof typeof COMPONENTS_ERRORS];

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ComponentsError extends Error {
  code: ComponentsErrorCode;
  field?: string;

  constructor(code: ComponentsErrorCode, message?: string, field?: string) {
    super(message ?? code);
    this.name = 'ComponentsError';
    this.code = code;
    this.field = field;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description?: string;
}

export interface ComponentSpec {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  props: ComponentProp[];
  variants: string[];
  states: string[];
  usageRules: string[];
  accessibilityNotes: string[];
  version: number;
}

export interface ResolvedComponentSpec extends ComponentSpec {
  _sources: Partial<Record<keyof ComponentSpec, 'base' | 'override'>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureProjectExists(projectId: string): Promise<void> {
  try {
    await getProject(projectId);
  } catch (err: any) {
    if (err instanceof RegistryError && err.code === 'PROJECT_NOT_FOUND') {
      throw new ComponentsError('PROJECT_NOT_FOUND', `Project '${projectId}' not found`);
    }
    throw err;
  }
}

function findBaseSpec(db: Database.Database, componentId: string): any | null {
  return (
    db
      .prepare(
        `SELECT cs.* FROM component_specs cs
         INNER JOIN projects p ON p.id = cs.project_id
         WHERE cs.id = ? AND p.parent_id IS NULL`
      )
      .get(componentId) ?? null
  );
}

function rowToSpec(row: any): ComponentSpec {
  const json = JSON.parse(row.spec_json);
  return {
    id: row.id,
    projectId: row.project_id,
    name: json.name,
    description: json.description,
    props: json.props ?? [],
    variants: json.variants ?? [],
    states: json.states ?? [],
    usageRules: json.usageRules ?? [],
    accessibilityNotes: json.accessibilityNotes ?? [],
    version: row.version,
  };
}

const SPEC_FIELDS = [
  'name',
  'description',
  'props',
  'variants',
  'states',
  'usageRules',
  'accessibilityNotes',
] as const;

const ARRAY_FIELDS = new Set(['props', 'variants', 'states', 'usageRules', 'accessibilityNotes']);

function resolveSpec(baseRow: any, overrideRow: any | null): ResolvedComponentSpec {
  const base = JSON.parse(baseRow.spec_json);
  const override = overrideRow ? JSON.parse(overrideRow.spec_json) : null;

  const _sources: Partial<Record<keyof ComponentSpec, 'base' | 'override'>> = {};
  const merged: any = {};

  for (const field of SPEC_FIELDS) {
    if (override !== null && field in override) {
      merged[field] = override[field];
      _sources[field] = 'override';
    } else if (field in base) {
      merged[field] = base[field];
      _sources[field] = 'base';
    } else if (ARRAY_FIELDS.has(field)) {
      // Array fields always present -- default to []
      merged[field] = [];
      _sources[field] = 'base';
    }
    // 'description' is optional -- only include in _sources if it actually has a value
  }

  // 'name' is always required -- ensure it is always present
  if (!('name' in merged)) {
    merged.name = base.name;
    _sources.name = 'base';
  }

  return {
    id: baseRow.id,
    projectId: baseRow.project_id,
    name: merged.name,
    description: merged.description,
    props: merged.props ?? [],
    variants: merged.variants ?? [],
    states: merged.states ?? [],
    usageRules: merged.usageRules ?? [],
    accessibilityNotes: merged.accessibilityNotes ?? [],
    version: baseRow.version,
    _sources,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createSpec(input: {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  props?: ComponentProp[];
  variants?: string[];
  states?: string[];
  usageRules?: string[];
  accessibilityNotes?: string[];
}): Promise<ComponentSpec> {
  await ensureProjectExists(input.projectId);

  const db = getDb();
  try {
    const specJson = JSON.stringify({
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      props: input.props ?? [],
      variants: input.variants ?? [],
      states: input.states ?? [],
      usageRules: input.usageRules ?? [],
      accessibilityNotes: input.accessibilityNotes ?? [],
    });

    try {
      db.prepare(
        `INSERT INTO component_specs (id, project_id, spec_json, version) VALUES (?, ?, ?, 0)`
      ).run(input.id, input.projectId, specJson);
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('UNIQUE constraint failed') || msg.includes('SQLITE_CONSTRAINT')) {
        throw new ComponentsError(
          'DUPLICATE_COMPONENT_ID',
          `Component '${input.id}' already exists in project '${input.projectId}'`
        );
      }
      throw err;
    }

    const row = db
      .prepare('SELECT * FROM component_specs WHERE id = ? AND project_id = ?')
      .get(input.id, input.projectId) as any;

    return rowToSpec(row);
  } finally {
    db.close();
  }
}

export async function getSpec(projectId: string, componentId: string): Promise<ResolvedComponentSpec> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const baseRow = findBaseSpec(db, componentId);
    if (!baseRow) {
      throw new ComponentsError(
        'COMPONENT_NOT_FOUND',
        `Component '${componentId}' not found`
      );
    }

    const overrideRow =
      (db
        .prepare('SELECT * FROM component_specs WHERE id = ? AND project_id = ?')
        .get(componentId, projectId) as any) ?? null;

    // If the caller IS the base project, override row == base row -- treat as no override
    const effectiveOverride =
      overrideRow && overrideRow.project_id !== baseRow.project_id ? overrideRow : null;

    return resolveSpec(baseRow, effectiveOverride);
  } finally {
    db.close();
  }
}

export async function listSpecs(projectId: string): Promise<ResolvedComponentSpec[]> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    // Single LEFT JOIN avoids N+1: one query returns base rows plus any per-project
    // override row in a single pass.
    const rows = db
      .prepare(
        `SELECT cs_base.id,
                cs_base.project_id,
                cs_base.spec_json,
                cs_base.version,
                cs_over.spec_json AS override_spec_json
         FROM component_specs cs_base
         INNER JOIN projects p ON p.id = cs_base.project_id AND p.parent_id IS NULL
         LEFT JOIN component_specs cs_over
           ON cs_over.id = cs_base.id AND cs_over.project_id = ?`
      )
      .all(projectId) as any[];

    return rows.map((row) => {
      const baseRow = {
        id: row.id,
        project_id: row.project_id,
        spec_json: row.spec_json,
        version: row.version,
      };
      // If override_spec_json is present, the LEFT JOIN matched — but only treat it
      // as a real override when the caller is NOT the base project itself.
      const effectiveOverride =
        row.override_spec_json !== null && row.override_spec_json !== undefined && projectId !== row.project_id
          ? { spec_json: row.override_spec_json }
          : null;

      return resolveSpec(baseRow, effectiveOverride);
    });
  } finally {
    db.close();
  }
}

export async function updateSpec(
  projectId: string,
  componentId: string,
  input: {
    version: number;
    name?: string;
    description?: string;
    props?: ComponentProp[];
    variants?: string[];
    states?: string[];
    usageRules?: string[];
    accessibilityNotes?: string[];
  }
): Promise<ComponentSpec> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const baseRow = findBaseSpec(db, componentId);
    if (!baseRow) {
      throw new ComponentsError(
        'COMPONENT_NOT_FOUND',
        `Component '${componentId}' not found`
      );
    }

    const existing = JSON.parse(baseRow.spec_json);
    const { version, ...fields } = input;

    // updateSpec always operates on the BASE spec row (baseRow.project_id), regardless of
    // which projectId was passed by the caller.  The projectId param here is only used to
    // validate that the caller's project exists — it does not scope the write.
    // Merge: only update fields present in input
    const updated: any = { ...existing };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) {
        updated[k] = v;
      }
    }

    const newSpecJson = JSON.stringify(updated);

    const result = db
      .prepare(
        `UPDATE component_specs SET spec_json = ?, version = version + 1
         WHERE id = ? AND project_id = ? AND version = ?`
      )
      .run(newSpecJson, componentId, baseRow.project_id, version);

    if (result.changes === 0) {
      throw new ComponentsError('CONFLICT', `Version conflict on component '${componentId}'`);
    }

    const updatedRow = db
      .prepare('SELECT * FROM component_specs WHERE id = ? AND project_id = ?')
      .get(componentId, baseRow.project_id) as any;

    return rowToSpec(updatedRow);
  } finally {
    db.close();
  }
}

export async function deleteSpec(projectId: string, componentId: string): Promise<void> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const baseRow = findBaseSpec(db, componentId);
    if (!baseRow) {
      throw new ComponentsError(
        'COMPONENT_NOT_FOUND',
        `Component '${componentId}' not found`
      );
    }

    // Delete base row AND all override rows (same id, different project_ids)
    db.prepare('DELETE FROM component_specs WHERE id = ?').run(componentId);
  } finally {
    db.close();
  }
}

export async function setOverride(
  projectId: string,
  componentId: string,
  override: Partial<
    Pick<
      ComponentSpec,
      'description' | 'props' | 'variants' | 'states' | 'usageRules' | 'accessibilityNotes'
    >
  >
): Promise<ResolvedComponentSpec> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const baseRow = findBaseSpec(db, componentId);
    if (!baseRow) {
      throw new ComponentsError(
        'COMPONENT_NOT_FOUND',
        `Component '${componentId}' not found`
      );
    }

    // Guard: setOverride is only meaningful for child projects.
    // If the caller IS the base project, throwing COMPONENT_NOT_FOUND mirrors the
    // fact that an "override row" has no semantic meaning on the base project itself,
    // and prevents INSERT OR REPLACE from silently corrupting the base spec row.
    if (projectId === baseRow.project_id) {
      throw new ComponentsError(
        'COMPONENT_NOT_FOUND',
        `Component '${componentId}' override is not applicable: project '${projectId}' is the base project. Use a child project to set overrides.`
      );
    }

    // Validate override keys
    for (const key of Object.keys(override)) {
      if (!(VALID_OVERRIDE_FIELDS as readonly string[]).includes(key)) {
        throw new ComponentsError(
          'INVALID_OVERRIDE_FIELD',
          `Field '${key}' is not a valid override field`,
          key
        );
      }
    }

    const overrideJson = JSON.stringify(override);

    db.prepare(
      `INSERT OR REPLACE INTO component_specs (id, project_id, spec_json, version) VALUES (?, ?, ?, 0)`
    ).run(componentId, projectId, overrideJson);
  } finally {
    db.close();
  }

  // getSpec opens its own connection
  return getSpec(projectId, componentId);
}

export async function deleteOverride(projectId: string, componentId: string): Promise<void> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const baseRow = findBaseSpec(db, componentId);
    if (!baseRow) {
      throw new ComponentsError(
        'COMPONENT_NOT_FOUND',
        `Component '${componentId}' not found`
      );
    }

    // Guard: if the caller IS the base project, there is no override row to delete.
    // Return immediately instead of issuing a DELETE that would wipe the base spec row.
    if (projectId === baseRow.project_id) {
      return;
    }

    // Idempotent -- no-op if no override row exists for this child project
    db.prepare('DELETE FROM component_specs WHERE id = ? AND project_id = ?').run(
      componentId,
      projectId
    );
  } finally {
    db.close();
  }
}
