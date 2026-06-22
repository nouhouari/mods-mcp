import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDb } from '../db/index';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class PatternsError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'PatternsError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Types (contract-aligned)
// ---------------------------------------------------------------------------

export interface Pattern {
  id: string;
  projectId: string;
  name: string;
  category: string;
  description?: string;
  tags?: string[];
  guidanceUrl?: string;
  variants?: PatternVariant[];
  relatedComponents?: string[];
  compositionRules?: CompositionRule[];
  createdAt: string;
  updatedAt: string;
}

export interface PatternVariant {
  id: string;
  name: string;
  description?: string;
  appliesAt: string;  // breakpoint context: mobile, tablet, desktop, etc.
}

export interface CompositionRule {
  id: string;
  projectId: string;
  patternAId: string;
  patternBId: string;
  relation: string;  // enum: NESTING_ALLOWED, NESTING_FORBIDDEN, OVERRIDE_CAUTION, SIBLING_ONLY, EXCLUSIVE
  guidance?: string;
  createdAt: string;
}

export interface LayoutGuideline {
  id: string;
  projectId: string;
  type: string;  // enum: breakpoints, spacing, grid, alignment, typography, animation
  name: string;
  description?: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  patterns?: T[];
  compositionRules?: T[];
  guidelines?: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Patterns CRUD
// ---------------------------------------------------------------------------

export async function createPattern(projectId: string, payload: {
  id: string;
  name: string;
  category: string;
  description?: string;
  tags?: string[];
  guidanceUrl?: string;
  variants?: Array<{
    name: string;
    description?: string;
    appliesAt: string;
  }>;
}): Promise<Pattern> {
  // Validate required fields
  if (!payload.id || !payload.name || !payload.category) {
    throw new PatternsError('INVALID_PATTERN_ID', 'id, name, and category are required');
  }

  // Validate id format (kebab-case)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(payload.id)) {
    throw new PatternsError('INVALID_PATTERN_ID', 'id must be kebab-case');
  }

  const db = getDb();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO patterns (id, project_id, name, category, description, tags, guidance_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      payload.id,
      projectId,
      payload.name,
      payload.category,
      payload.description ?? null,
      payload.tags ? JSON.stringify(payload.tags) : null,
      payload.guidanceUrl ?? null,
      now,
      now
    );

    // Create variants if provided
    let variants: PatternVariant[] = [];
    if (payload.variants && payload.variants.length > 0) {
      variants = await Promise.all(
        payload.variants.map(v => createVariant(projectId, payload.id, v))
      );
    }

    return {
      id: payload.id,
      projectId,
      name: payload.name,
      category: payload.category,
      description: payload.description,
      tags: payload.tags,
      guidanceUrl: payload.guidanceUrl,
      variants,
      relatedComponents: [],
      compositionRules: [],
      createdAt: now,
      updatedAt: now,
    };
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new PatternsError('DUPLICATE_PATTERN_ID', `Pattern with id '${payload.id}' already exists`);
    }
    throw err;
  }
}

export async function listPatterns(projectId: string, query: {
  category?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<Pattern>> {
  const db = getDb();
  const limit = Math.min(query.limit ?? 20, 100);
  const offset = query.offset ?? 0;

  let countSql = 'SELECT COUNT(*) as count FROM patterns WHERE project_id = ?';
  let dataSql = 'SELECT * FROM patterns WHERE project_id = ?';
  const params: any[] = [projectId];

  if (query.category) {
    countSql += ' AND category = ?';
    dataSql += ' AND category = ?';
    params.push(query.category);
  }

  const countStmt = db.prepare(countSql);
  const countResult = countStmt.get(...params) as any;
  const total = countResult.count;

  dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const dataStmt = db.prepare(dataSql);
  const rows = dataStmt.all(...params, limit, offset) as any[];

  let patterns = rows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    category: row.category,
    description: row.description,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    guidanceUrl: row.guidance_url,
    relatedComponents: [],
    compositionRules: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Pattern));

  // Filter by tag if specified
  if (query.tag) {
    patterns = patterns.filter(p => p.tags && p.tags.includes(query.tag!));
  }

  return {
    patterns: patterns.slice(0, limit),
    total: query.tag ? patterns.length : total,
    limit,
    offset,
  };
}

export async function getPattern(projectId: string, patternId: string): Promise<Pattern> {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM patterns WHERE id = ? AND project_id = ?');
  const row = stmt.get(patternId, projectId) as any;

  if (!row) {
    throw new PatternsError('PATTERN_NOT_FOUND', `Pattern '${patternId}' was not found in project '${projectId}'.`);
  }

  // Load variants and composition rules
  const variants = await listVariantsInternal(projectId, patternId);
  const compositionRules = await getCompositionRulesInternal(projectId, patternId);

  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    category: row.category,
    description: row.description,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    guidanceUrl: row.guidance_url,
    variants,
    relatedComponents: [],
    compositionRules,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updatePattern(
  projectId: string,
  patternId: string,
  payload: Partial<{
    name: string;
    description: string;
    tags: string[];
    guidanceUrl: string;
  }>
): Promise<Pattern> {
  const db = getDb();

  // Get existing pattern
  const existing = await getPattern(projectId, patternId);

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (payload.name !== undefined) {
    updates.push('name = ?');
    values.push(payload.name);
  }
  if (payload.description !== undefined) {
    updates.push('description = ?');
    values.push(payload.description);
  }
  if (payload.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(payload.tags));
  }
  if (payload.guidanceUrl !== undefined) {
    updates.push('guidance_url = ?');
    values.push(payload.guidanceUrl);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(patternId);
  values.push(projectId);

  const sql = `UPDATE patterns SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getPattern(projectId, patternId);
}

export async function deletePattern(projectId: string, patternId: string): Promise<void> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(projectId, patternId);

  const stmt = db.prepare('DELETE FROM patterns WHERE id = ? AND project_id = ?');
  stmt.run(patternId, projectId);
}

// ---------------------------------------------------------------------------
// Pattern Variants
// ---------------------------------------------------------------------------

export async function createVariant(
  projectId: string,
  patternId: string,
  payload: {
    name: string;
    description?: string;
    appliesAt: string;
  }
): Promise<PatternVariant> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(projectId, patternId);

  // Validate required fields
  if (!payload.name || !payload.appliesAt) {
    throw new PatternsError('INVALID_VARIANT', 'name and appliesAt are required');
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO pattern_variants (id, pattern_id, project_id, name, description, applies_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      patternId,
      projectId,
      payload.name,
      payload.description ?? null,
      payload.appliesAt,
      now,
      now
    );
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new PatternsError('DUPLICATE_VARIANT', `Variant '${payload.name}' already exists`);
    }
    throw err;
  }

  return {
    id,
    name: payload.name,
    description: payload.description,
    appliesAt: payload.appliesAt,
  };
}

export async function listVariants(projectId: string, patternId: string): Promise<PatternVariant[]> {
  // Verify pattern exists
  await getPattern(projectId, patternId);
  return listVariantsInternal(projectId, patternId);
}

async function listVariantsInternal(projectId: string, patternId: string): Promise<PatternVariant[]> {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT id, name, description, applies_at FROM pattern_variants WHERE pattern_id = ? AND project_id = ? ORDER BY created_at'
  );
  const rows = stmt.all(patternId, projectId) as any[];

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    appliesAt: row.applies_at,
  }));
}

export async function getVariant(projectId: string, patternId: string, variantId: string): Promise<PatternVariant> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(projectId, patternId);

  const stmt = db.prepare(
    'SELECT id, name, description, applies_at FROM pattern_variants WHERE id = ? AND pattern_id = ? AND project_id = ?'
  );
  const row = stmt.get(variantId, patternId, projectId) as any;

  if (!row) {
    throw new PatternsError('VARIANT_NOT_FOUND', `Variant '${variantId}' not found`);
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    appliesAt: row.applies_at,
  };
}

export async function updateVariant(
  projectId: string,
  patternId: string,
  variantId: string,
  payload: Partial<{ name: string; description: string; appliesAt: string }>
): Promise<PatternVariant> {
  const db = getDb();

  // Get existing variant
  const existing = await getVariant(projectId, patternId, variantId);

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (payload.name !== undefined) {
    updates.push('name = ?');
    values.push(payload.name);
  }
  if (payload.description !== undefined) {
    updates.push('description = ?');
    values.push(payload.description);
  }
  if (payload.appliesAt !== undefined) {
    updates.push('applies_at = ?');
    values.push(payload.appliesAt);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(variantId);
  values.push(patternId);
  values.push(projectId);

  const sql = `UPDATE pattern_variants SET ${updates.join(', ')} WHERE id = ? AND pattern_id = ? AND project_id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getVariant(projectId, patternId, variantId);
}

export async function deleteVariant(projectId: string, patternId: string, variantId: string): Promise<void> {
  const db = getDb();

  // Verify variant exists
  await getVariant(projectId, patternId, variantId);

  const stmt = db.prepare('DELETE FROM pattern_variants WHERE id = ? AND pattern_id = ? AND project_id = ?');
  stmt.run(variantId, patternId, projectId);
}

// ---------------------------------------------------------------------------
// Composition Rules
// ---------------------------------------------------------------------------

export async function createCompositionRule(projectId: string, payload: {
  patternAId: string;
  patternBId: string;
  relation: string;
  guidance?: string;
}): Promise<CompositionRule> {
  const db = getDb();

  // Verify both patterns exist
  await getPattern(projectId, payload.patternAId);
  await getPattern(projectId, payload.patternBId);

  // Validate relation enum
  const validRelations = ['NESTING_ALLOWED', 'NESTING_FORBIDDEN', 'OVERRIDE_CAUTION', 'SIBLING_ONLY', 'EXCLUSIVE'];
  if (!validRelations.includes(payload.relation)) {
    throw new PatternsError('INVALID_RELATION', `relation must be one of: ${validRelations.join(', ')}`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO composition_rules (id, project_id, pattern_a_id, pattern_b_id, relation, guidance, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      projectId,
      payload.patternAId,
      payload.patternBId,
      payload.relation,
      payload.guidance ?? null,
      now
    );
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new PatternsError('DUPLICATE_COMPOSITION_RULE', 'Composition rule already exists');
    }
    throw err;
  }

  return {
    id,
    projectId,
    patternAId: payload.patternAId,
    patternBId: payload.patternBId,
    relation: payload.relation,
    guidance: payload.guidance,
    createdAt: now,
  };
}

export async function listCompositionRules(projectId: string, query: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<CompositionRule>> {
  const db = getDb();
  const limit = Math.min(query.limit ?? 20, 100);
  const offset = query.offset ?? 0;

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM composition_rules WHERE project_id = ?');
  const countResult = countStmt.get(projectId) as any;
  const total = countResult.count;

  const dataStmt = db.prepare(
    'SELECT * FROM composition_rules WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  );
  const rows = dataStmt.all(projectId, limit, offset) as any[];

  const compositionRules = rows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    patternAId: row.pattern_a_id,
    patternBId: row.pattern_b_id,
    relation: row.relation,
    guidance: row.guidance,
    createdAt: row.created_at,
  }));

  return {
    compositionRules,
    total,
    limit,
    offset,
  };
}

export async function getCompositionRules(projectId: string, patternId: string): Promise<CompositionRule[]> {
  // Verify pattern exists
  await getPattern(projectId, patternId);
  return getCompositionRulesInternal(projectId, patternId);
}

async function getCompositionRulesInternal(projectId: string, patternId: string): Promise<CompositionRule[]> {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM composition_rules WHERE project_id = ? AND (pattern_a_id = ? OR pattern_b_id = ?) ORDER BY created_at'
  );
  const rows = stmt.all(projectId, patternId, patternId) as any[];

  return rows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    patternAId: row.pattern_a_id,
    patternBId: row.pattern_b_id,
    relation: row.relation,
    guidance: row.guidance,
    createdAt: row.created_at,
  }));
}

export async function deleteCompositionRule(projectId: string, ruleId: string): Promise<void> {
  const db = getDb();

  const stmt = db.prepare('SELECT * FROM composition_rules WHERE id = ? AND project_id = ?');
  const row = stmt.get(ruleId, projectId) as any;

  if (!row) {
    throw new PatternsError('COMPOSITION_RULE_NOT_FOUND', 'Composition rule not found');
  }

  const deleteStmt = db.prepare('DELETE FROM composition_rules WHERE id = ? AND project_id = ?');
  deleteStmt.run(ruleId, projectId);
}

// ---------------------------------------------------------------------------
// Layout Guidelines
// ---------------------------------------------------------------------------

export async function createLayoutGuideline(
  projectId: string,
  payload: {
    type: string;
    name: string;
    description?: string;
    data: Record<string, any>;
  }
): Promise<LayoutGuideline> {
  // Validate required fields
  if (!payload.type || !payload.name || !payload.data) {
    throw new PatternsError('INVALID_GUIDELINE', 'type, name, and data are required');
  }

  // Validate type enum
  const validTypes = ['breakpoints', 'spacing', 'grid', 'alignment', 'typography', 'animation'];
  if (!validTypes.includes(payload.type)) {
    throw new PatternsError('INVALID_TYPE', `type must be one of: ${validTypes.join(', ')}`);
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO layout_guidelines (id, project_id, type, name, description, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      projectId,
      payload.type,
      payload.name,
      payload.description ?? null,
      JSON.stringify(payload.data),
      now,
      now
    );
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new PatternsError('GUIDELINE_IN_USE', `Guideline '${payload.name}' already exists`);
    }
    throw err;
  }

  return {
    id,
    projectId,
    type: payload.type,
    name: payload.name,
    description: payload.description,
    data: payload.data,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listLayoutGuidelines(projectId: string, query: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<LayoutGuideline>> {
  const db = getDb();
  const limit = Math.min(query.limit ?? 20, 100);
  const offset = query.offset ?? 0;

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM layout_guidelines WHERE project_id = ?');
  const countResult = countStmt.get(projectId) as any;
  const total = countResult.count;

  const dataStmt = db.prepare(
    'SELECT * FROM layout_guidelines WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  );
  const rows = dataStmt.all(projectId, limit, offset) as any[];

  const guidelines = rows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    name: row.name,
    description: row.description,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    guidelines,
    total,
    limit,
    offset,
  };
}

export async function getLayoutGuideline(projectId: string, guidelineId: string): Promise<LayoutGuideline> {
  const db = getDb();

  const stmt = db.prepare(
    'SELECT * FROM layout_guidelines WHERE id = ? AND project_id = ?'
  );
  const row = stmt.get(guidelineId, projectId) as any;

  if (!row) {
    throw new PatternsError('GUIDELINE_NOT_FOUND', 'Layout guideline not found');
  }

  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    name: row.name,
    description: row.description,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateLayoutGuideline(
  projectId: string,
  guidelineId: string,
  payload: Partial<{
    name: string;
    description: string;
    data: Record<string, any>;
  }>
): Promise<LayoutGuideline> {
  const db = getDb();

  // Get existing guideline
  const existing = await getLayoutGuideline(projectId, guidelineId);

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (payload.name !== undefined) {
    updates.push('name = ?');
    values.push(payload.name);
  }
  if (payload.description !== undefined) {
    updates.push('description = ?');
    values.push(payload.description);
  }
  if (payload.data !== undefined) {
    updates.push('data = ?');
    values.push(JSON.stringify(payload.data));
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(guidelineId);
  values.push(projectId);

  const sql = `UPDATE layout_guidelines SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getLayoutGuideline(projectId, guidelineId);
}

export async function deleteLayoutGuideline(projectId: string, guidelineId: string): Promise<void> {
  const db = getDb();

  // Verify guideline exists
  await getLayoutGuideline(projectId, guidelineId);

  const stmt = db.prepare('DELETE FROM layout_guidelines WHERE id = ? AND project_id = ?');
  stmt.run(guidelineId, projectId);
}
