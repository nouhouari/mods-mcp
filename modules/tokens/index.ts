import Database from 'better-sqlite3';
import { getDb } from '../db/index';
import { getProject, RegistryError } from '../registry/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_CATEGORIES = ['color', 'spacing', 'typography', 'radius', 'shadow', 'breakpoint', 'border', 'motion', 'other'] as const;
type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class TokensError extends Error {
  code: string;
  offendingKey?: string;
  referencedBy?: string[];
  constructor(code: string, opts?: { message?: string; offendingKey?: string; referencedBy?: string[] }) {
    super(opts?.message ?? code);
    this.name = 'TokensError';
    this.code = code;
    this.offendingKey = opts?.offendingKey;
    this.referencedBy = opts?.referencedBy;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Token {
  id: number;
  projectId: string;
  key: string;
  category: TokenCategory;
  value: string;
  isSemantic: boolean;
  semanticRef?: string;
  version: number;
}

export interface ResolvedToken {
  key: string;
  category: TokenCategory;
  value: string;
  source: 'base' | 'override';
  isSemantic: boolean;
  semanticRef?: string;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToToken(row: any): Token {
  return {
    id: row.id,
    projectId: row.project_id,
    key: row.key,
    category: row.category as TokenCategory,
    value: row.value,
    isSemantic: row.is_semantic === 1,
    semanticRef: row.semantic_ref ?? undefined,
    version: row.version,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateCategory(category: string): void {
  if (!(TOKEN_CATEGORIES as readonly string[]).includes(category)) {
    throw new TokensError('INVALID_CATEGORY', { message: `Invalid category: ${category}` });
  }
}

async function ensureProjectExists(projectId: string): Promise<void> {
  try {
    await getProject(projectId);
  } catch (err: any) {
    if (err instanceof RegistryError && err.code === 'PROJECT_NOT_FOUND') {
      throw new TokensError('PROJECT_NOT_FOUND', { message: `Project '${projectId}' not found` });
    }
    throw err;
  }
}

function checkCircularRef(db: Database.Database, projectId: string, newKey: string, semanticRef: string): void {
  // Check if following the semanticRef chain from semanticRef ever reaches newKey (circular)
  const result = db.prepare(`
    WITH RECURSIVE chain(k, depth) AS (
      SELECT t.semantic_ref, 1
      FROM tokens t
      WHERE t.project_id = ? AND t.key = ? AND t.semantic_ref IS NOT NULL
      UNION ALL
      SELECT t.semantic_ref, c.depth + 1
      FROM tokens t JOIN chain c ON t.key = c.k
      WHERE t.project_id = ? AND t.semantic_ref IS NOT NULL AND c.depth < 100
    )
    SELECT k FROM chain WHERE k = ?
  `).get(projectId, semanticRef, projectId, newKey) as any;

  if (result) {
    throw new TokensError('CIRCULAR_REFERENCE', { offendingKey: newKey });
  }

  // Check chain depth
  const depth = db.prepare(`
    WITH RECURSIVE chain(k, depth) AS (
      SELECT semantic_ref, 1 FROM tokens WHERE project_id = ? AND key = ? AND semantic_ref IS NOT NULL
      UNION ALL
      SELECT t.semantic_ref, c.depth + 1
      FROM tokens t JOIN chain c ON t.key = c.k
      WHERE t.project_id = ? AND t.semantic_ref IS NOT NULL AND c.depth < 100
    )
    SELECT MAX(depth) as max_depth FROM chain
  `).get(projectId, semanticRef, projectId) as any;

  if (depth?.max_depth != null && depth.max_depth >= 100) {
    throw new TokensError('REFERENCE_CHAIN_TOO_DEEP');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createToken(input: {
  projectId: string;
  key: string;
  category: string;
  value: string;
  isSemantic?: boolean;
  semanticRef?: string;
}): Promise<Token> {
  validateCategory(input.category);
  await ensureProjectExists(input.projectId);

  const db = getDb();
  try {
    const isSemantic = input.isSemantic ?? false;

    if (isSemantic && input.semanticRef) {
      checkCircularRef(db, input.projectId, input.key, input.semanticRef);
    }

    try {
      db.prepare(
        `INSERT INTO tokens (project_id, key, category, value, is_semantic, semantic_ref, version)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      ).run(
        input.projectId,
        input.key,
        input.category,
        input.value,
        isSemantic ? 1 : 0,
        input.semanticRef ?? null
      );
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('UNIQUE constraint failed')) {
        throw new TokensError('DUPLICATE_TOKEN_KEY', {
          message: `Token '${input.key}' already exists in category '${input.category}' for project '${input.projectId}'`,
        });
      }
      if (msg.includes('tokens.semantic_ref does not match any key in this project')) {
        throw new TokensError('TOKEN_NOT_FOUND', {
          message: `Semantic ref '${input.semanticRef}' not found in project '${input.projectId}'`,
        });
      }
      throw err;
    }

    const row = db.prepare(
      'SELECT * FROM tokens WHERE project_id = ? AND key = ? AND category = ?'
    ).get(input.projectId, input.key, input.category) as any;

    return rowToToken(row);
  } finally {
    db.close();
  }
}

export async function getToken(projectId: string, key: string): Promise<Token> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND key = ?').get(projectId, key) as any;
    if (!row) {
      throw new TokensError('TOKEN_NOT_FOUND', { message: `Token '${key}' not found in project '${projectId}'` });
    }
    return rowToToken(row);
  } finally {
    db.close();
  }
}

export async function listTokens(projectId: string, category?: string): Promise<Token[]> {
  if (category !== undefined) {
    validateCategory(category);
  }
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    let rows: any[];
    if (category) {
      rows = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND category = ?').all(projectId, category) as any[];
    } else {
      rows = db.prepare('SELECT * FROM tokens WHERE project_id = ?').all(projectId) as any[];
    }
    return rows.map(rowToToken);
  } finally {
    db.close();
  }
}

export async function updateToken(
  projectId: string,
  key: string,
  input: { version: number; value?: string; semanticRef?: string }
): Promise<Token> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const existing = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND key = ?').get(projectId, key) as any;
    if (!existing) {
      throw new TokensError('TOKEN_NOT_FOUND', { message: `Token '${key}' not found in project '${projectId}'` });
    }

    // OCC check
    if (existing.version !== input.version) {
      throw new TokensError('CONFLICT', { message: `Version mismatch: expected ${existing.version}, got ${input.version}` });
    }

    const newValue = input.value ?? existing.value;
    const newSemanticRef = input.semanticRef !== undefined ? input.semanticRef : existing.semantic_ref;

    if (existing.is_semantic === 1 && newSemanticRef) {
      checkCircularRef(db, projectId, key, newSemanticRef);
    }

    try {
      db.prepare(
        `UPDATE tokens SET value = ?, semantic_ref = ?, version = version + 1
         WHERE project_id = ? AND key = ? AND version = ?`
      ).run(newValue, newSemanticRef ?? null, projectId, key, input.version);
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.includes('tokens.semantic_ref does not match any key in this project')) {
        throw new TokensError('TOKEN_NOT_FOUND', {
          message: `Semantic ref '${newSemanticRef}' not found in project '${projectId}'`,
        });
      }
      throw err;
    }

    const row = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND key = ?').get(projectId, key) as any;
    return rowToToken(row);
  } finally {
    db.close();
  }
}

export async function deleteToken(projectId: string, key: string, version: number): Promise<void> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const existing = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND key = ?').get(projectId, key) as any;
    if (!existing) {
      throw new TokensError('TOKEN_NOT_FOUND', { message: `Token '${key}' not found in project '${projectId}'` });
    }

    if (existing.version !== version) {
      throw new TokensError('CONFLICT', { message: `Version mismatch` });
    }

    // Check for semantic references
    const refs = db.prepare(
      'SELECT key FROM tokens WHERE project_id = ? AND semantic_ref = ?'
    ).all(projectId, key) as any[];

    if (refs.length > 0) {
      throw new TokensError('TOKEN_REFERENCED_BY_SEMANTIC', {
        message: `Token '${key}' is referenced by semantic tokens`,
        referencedBy: refs.map((r: any) => r.key),
      });
    }

    db.prepare('DELETE FROM tokens WHERE project_id = ? AND key = ? AND version = ?').run(projectId, key, version);
  } finally {
    db.close();
  }
}

export async function resolveTokens(projectId: string, category?: string): Promise<ResolvedToken[]> {
  if (category !== undefined) {
    validateCategory(category);
  }
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    const isBaseProject = project.parent_id === null || project.parent_id === undefined;

    if (isBaseProject) {
      // Return all tokens with source='base'
      let rows: any[];
      if (category) {
        rows = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND category = ?').all(projectId, category) as any[];
      } else {
        rows = db.prepare('SELECT * FROM tokens WHERE project_id = ?').all(projectId) as any[];
      }
      return rows.map((r: any) => ({
        key: r.key,
        category: r.category as TokenCategory,
        value: r.value,
        source: 'base' as const,
        isSemantic: r.is_semantic === 1,
        semanticRef: r.semantic_ref ?? undefined,
      }));
    } else {
      // Child project: merge base tokens with overrides
      const parentId = project.parent_id;

      let baseRows: any[];
      let overrideRows: any[];

      if (category) {
        baseRows = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND category = ?').all(parentId, category) as any[];
        overrideRows = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND category = ?').all(projectId, category) as any[];
      } else {
        baseRows = db.prepare('SELECT * FROM tokens WHERE project_id = ?').all(parentId) as any[];
        overrideRows = db.prepare('SELECT * FROM tokens WHERE project_id = ?').all(projectId) as any[];
      }

      const merged = new Map<string, ResolvedToken>();

      for (const r of baseRows) {
        merged.set(r.key, {
          key: r.key,
          category: r.category as TokenCategory,
          value: r.value,
          source: 'base' as const,
          isSemantic: r.is_semantic === 1,
          semanticRef: r.semantic_ref ?? undefined,
        });
      }

      for (const r of overrideRows) {
        merged.set(r.key, {
          key: r.key,
          category: r.category as TokenCategory,
          value: r.value,
          source: 'override' as const,
          isSemantic: r.is_semantic === 1,
          semanticRef: r.semantic_ref ?? undefined,
        });
      }

      return Array.from(merged.values());
    }
  } finally {
    db.close();
  }
}

export async function setOverride(
  projectId: string,
  key: string,
  value: string,
  version: number
): Promise<Token> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    const parentId = project.parent_id;

    if (!parentId) {
      throw new TokensError('PROJECT_NOT_FOUND', { message: `Project '${projectId}' is not a child project` });
    }

    // Find the base token to get category
    const baseToken = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND key = ?').get(parentId, key) as any;
    if (!baseToken) {
      throw new TokensError('TOKEN_NOT_FOUND', { message: `Token '${key}' not found in base project '${parentId}'` });
    }

    // Check if override already exists
    const existing = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND key = ?').get(projectId, key) as any;

    if (existing) {
      // OCC check
      if (existing.version !== version) {
        throw new TokensError('CONFLICT', { message: `Version mismatch` });
      }
      // F1: differentiate UNIQUE constraint (409) from other DB errors (rethrow as 500)
      try {
        db.prepare(
          'UPDATE tokens SET value = ?, version = version + 1 WHERE project_id = ? AND key = ? AND version = ?'
        ).run(value, projectId, key, version);
      } catch (err: any) {
        const msg = (err as Error).message ?? '';
        if (msg.includes('UNIQUE constraint failed')) {
          throw new TokensError('CONFLICT', { message: `Token '${key}' was modified concurrently in project '${projectId}'` });
        }
        throw err;
      }
    } else {
      // F2: INSERT on first set — CONFLICT only on true duplicate key (race), not on version mismatch
      try {
        db.prepare(
          `INSERT INTO tokens (project_id, key, category, value, is_semantic, semantic_ref, version)
           VALUES (?, ?, ?, ?, 0, NULL, 0)`
        ).run(projectId, key, baseToken.category, value);
      } catch (err: any) {
        const msg = (err as Error).message ?? '';
        if (msg.includes('UNIQUE constraint failed')) {
          throw new TokensError('CONFLICT', { message: `Token '${key}' already has an override in project '${projectId}'` });
        }
        throw err;
      }
    }

    const row = db.prepare('SELECT * FROM tokens WHERE project_id = ? AND key = ?').get(projectId, key) as any;
    return rowToToken(row);
  } finally {
    db.close();
  }
}

export async function deleteOverride(projectId: string, key: string): Promise<void> {
  await ensureProjectExists(projectId);

  const db = getDb();
  try {
    // No-op if override doesn't exist — don't throw
    db.prepare('DELETE FROM tokens WHERE project_id = ? AND key = ?').run(projectId, key);
  } finally {
    db.close();
  }
}
