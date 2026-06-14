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
// Types
// ---------------------------------------------------------------------------

export interface PatternResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  schema_json?: string;
  created_at: string;
  updated_at: string;
}

export interface VariantResponse {
  id: string;
  pattern_id: string;
  name: string;
  props: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RuleResponse {
  id: string;
  parent_id: string;
  child_id: string;
  relationship: string;
  cardinality: string;
  created_at: string;
  updated_at: string;
}

export interface GuidelineResponse {
  id: string;
  pattern_id: string;
  name: string;
  description?: string;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  padding?: Record<string, number>;
  gap?: number;
  breakpoint?: number;
  breakpoints?: Array<Record<string, any>>;
  z_index?: number;
  above?: string[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// ---------------------------------------------------------------------------
// Patterns CRUD
// ---------------------------------------------------------------------------

export async function createPattern(payload: {
  name: string;
  description: string;
  category: string;
  version: string;
  schema_json?: string;
}): Promise<PatternResponse> {
  // Validate required fields
  if (!payload.name || !payload.description || !payload.category || !payload.version) {
    throw new PatternsError('INVALID_PATTERN', 'name, description, category, and version are required');
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO patterns (id, name, description, category, version, schema_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    payload.name,
    payload.description,
    payload.category,
    payload.version,
    payload.schema_json ?? null,
    now,
    now
  );

  return {
    id,
    name: payload.name,
    description: payload.description,
    category: payload.category,
    version: payload.version,
    schema_json: payload.schema_json,
    created_at: now,
    updated_at: now,
  };
}

export async function listPatterns(query: {
  limit?: number;
  offset?: number;
  category?: string;
}): Promise<PaginatedResponse<PatternResponse>> {
  const db = getDb();
  const limit = Math.min(query.limit ?? 10, 100);
  const offset = query.offset ?? 0;

  let countSql = 'SELECT COUNT(*) as count FROM patterns';
  let dataSql = 'SELECT * FROM patterns';
  const params: any[] = [];

  if (query.category) {
    const whereClause = 'WHERE category = ?';
    countSql += ' ' + whereClause;
    dataSql += ' ' + whereClause;
    params.push(query.category);
  }

  const countStmt = db.prepare(countSql);
  const countResult = countStmt.get(...params) as any;
  const total = countResult.count;

  dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const dataStmt = db.prepare(dataSql);
  const rows = dataStmt.all(...params, limit, offset) as any[];

  const data = rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    version: row.version,
    schema_json: row.schema_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return {
    data,
    pagination: { total, limit, offset },
  };
}

export async function getPattern(patternId: string): Promise<PatternResponse> {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM patterns WHERE id = ?');
  const row = stmt.get(patternId) as any;

  if (!row) {
    throw new PatternsError('PATTERN_NOT_FOUND', 'Pattern not found');
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    version: row.version,
    schema_json: row.schema_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updatePattern(
  patternId: string,
  payload: Partial<{
    name: string;
    description: string;
    category: string;
    version: string;
    schema_json: string;
  }>
): Promise<PatternResponse> {
  const db = getDb();

  // Get existing pattern
  const existing = await getPattern(patternId);

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
  if (payload.category !== undefined) {
    updates.push('category = ?');
    values.push(payload.category);
  }
  if (payload.version !== undefined) {
    updates.push('version = ?');
    values.push(payload.version);
  }
  if (payload.schema_json !== undefined) {
    updates.push('schema_json = ?');
    values.push(payload.schema_json);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(patternId);

  const sql = `UPDATE patterns SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getPattern(patternId);
}

export async function deletePattern(patternId: string): Promise<void> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  const stmt = db.prepare('DELETE FROM patterns WHERE id = ?');
  stmt.run(patternId);
}

// ---------------------------------------------------------------------------
// Pattern Variants
// ---------------------------------------------------------------------------

export async function createVariant(
  patternId: string,
  payload: {
    name: string;
    props: Record<string, any>;
  }
): Promise<VariantResponse> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  // Validate required fields
  if (!payload.name || !payload.props) {
    throw new PatternsError('INVALID_VARIANT', 'name and props are required');
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO pattern_variants (id, pattern_id, name, props, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, patternId, payload.name, JSON.stringify(payload.props), now, now);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new PatternsError('DUPLICATE_VARIANT', `Variant '${payload.name}' already exists`);
    }
    throw err;
  }

  return {
    id,
    pattern_id: patternId,
    name: payload.name,
    props: payload.props,
    created_at: now,
    updated_at: now,
  };
}

export async function listVariants(patternId: string): Promise<VariantResponse[]> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  const stmt = db.prepare('SELECT * FROM pattern_variants WHERE pattern_id = ? ORDER BY created_at');
  const rows = stmt.all(patternId) as any[];

  return rows.map((row: any) => ({
    id: row.id,
    pattern_id: row.pattern_id,
    name: row.name,
    props: JSON.parse(row.props),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getVariant(patternId: string, variantName: string): Promise<VariantResponse> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  const stmt = db.prepare('SELECT * FROM pattern_variants WHERE pattern_id = ? AND name = ?');
  const row = stmt.get(patternId, variantName) as any;

  if (!row) {
    throw new PatternsError('VARIANT_NOT_FOUND', `Variant '${variantName}' not found`);
  }

  return {
    id: row.id,
    pattern_id: row.pattern_id,
    name: row.name,
    props: JSON.parse(row.props),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateVariant(
  patternId: string,
  variantName: string,
  payload: Partial<{ name: string; props: Record<string, any> }>
): Promise<VariantResponse> {
  const db = getDb();

  // Get existing variant
  const existing = await getVariant(patternId, variantName);

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (payload.name !== undefined) {
    updates.push('name = ?');
    values.push(payload.name);
  }
  if (payload.props !== undefined) {
    updates.push('props = ?');
    values.push(JSON.stringify(payload.props));
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(patternId);
  values.push(variantName);

  const sql = `UPDATE pattern_variants SET ${updates.join(', ')} WHERE pattern_id = ? AND name = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getVariant(patternId, payload.name ?? variantName);
}

export async function deleteVariant(patternId: string, variantName: string): Promise<void> {
  const db = getDb();

  // Verify variant exists
  await getVariant(patternId, variantName);

  const stmt = db.prepare('DELETE FROM pattern_variants WHERE pattern_id = ? AND name = ?');
  stmt.run(patternId, variantName);
}

// ---------------------------------------------------------------------------
// Composition Rules
// ---------------------------------------------------------------------------

export async function createCompositionRule(payload: {
  parent_id: string;
  child_id: string;
  relationship: string;
  cardinality: string;
}): Promise<RuleResponse> {
  const db = getDb();

  // Verify both patterns exist
  await getPattern(payload.parent_id);
  await getPattern(payload.child_id);

  // Check for circular dependencies
  checkCircularDependency(db, payload.parent_id, payload.child_id);

  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO composition_rules (id, parent_id, child_id, relationship, cardinality, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      payload.parent_id,
      payload.child_id,
      payload.relationship,
      payload.cardinality,
      now,
      now
    );
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new PatternsError('DUPLICATE_RULE', 'Rule already exists');
    }
    throw err;
  }

  return {
    id,
    parent_id: payload.parent_id,
    child_id: payload.child_id,
    relationship: payload.relationship,
    cardinality: payload.cardinality,
    created_at: now,
    updated_at: now,
  };
}

function checkCircularDependency(
  db: Database.Database,
  parentId: string,
  childId: string
): void {
  // Check if childId already has parentId as a descendant
  const sql = `
    WITH RECURSIVE descendants(id) AS (
      SELECT child_id FROM composition_rules WHERE parent_id = ?
      UNION ALL
      SELECT child_id FROM composition_rules
      WHERE parent_id IN (SELECT id FROM descendants)
    )
    SELECT COUNT(*) as count FROM descendants WHERE id = ?
  `;

  const stmt = db.prepare(sql);
  const result = stmt.get(childId, parentId) as any;

  if (result.count > 0) {
    throw new PatternsError('CIRCULAR_DEPENDENCY', 'Circular dependency detected');
  }
}

export async function listCompositionRules(query: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<RuleResponse>> {
  const db = getDb();
  const limit = Math.min(query.limit ?? 10, 100);
  const offset = query.offset ?? 0;

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM composition_rules');
  const countResult = countStmt.get() as any;
  const total = countResult.count;

  const dataStmt = db.prepare(
    'SELECT * FROM composition_rules ORDER BY created_at DESC LIMIT ? OFFSET ?'
  );
  const rows = dataStmt.all(limit, offset) as any[];

  const data = rows.map((row: any) => ({
    id: row.id,
    parent_id: row.parent_id,
    child_id: row.child_id,
    relationship: row.relationship,
    cardinality: row.cardinality,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return {
    data,
    pagination: { total, limit, offset },
  };
}

export async function getCompositionRules(patternId: string): Promise<RuleResponse[]> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  const stmt = db.prepare('SELECT * FROM composition_rules WHERE parent_id = ? ORDER BY created_at');
  const rows = stmt.all(patternId) as any[];

  return rows.map((row: any) => ({
    id: row.id,
    parent_id: row.parent_id,
    child_id: row.child_id,
    relationship: row.relationship,
    cardinality: row.cardinality,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function deleteCompositionRule(ruleId: string): Promise<void> {
  const db = getDb();

  const stmt = db.prepare('SELECT * FROM composition_rules WHERE id = ?');
  const row = stmt.get(ruleId) as any;

  if (!row) {
    throw new PatternsError('RULE_NOT_FOUND', 'Composition rule not found');
  }

  const deleteStmt = db.prepare('DELETE FROM composition_rules WHERE id = ?');
  deleteStmt.run(ruleId);
}

// ---------------------------------------------------------------------------
// Layout Guidelines
// ---------------------------------------------------------------------------

export async function createLayoutGuideline(
  patternId: string,
  payload: {
    name: string;
    description?: string;
    min_width?: number;
    max_width?: number;
    min_height?: number;
    max_height?: number;
    padding?: Record<string, number>;
    gap?: number;
    breakpoint?: number;
    breakpoints?: Array<Record<string, any>>;
    z_index?: number;
    above?: string[];
  }
): Promise<GuidelineResponse> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  if (!payload.name) {
    throw new PatternsError('INVALID_GUIDELINE', 'name is required');
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    const stmt = db.prepare(`
      INSERT INTO layout_guidelines 
      (id, pattern_id, name, description, min_width, max_width, min_height, max_height, 
       padding, gap, breakpoint, breakpoints, z_index, above, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      patternId,
      payload.name,
      payload.description ?? null,
      payload.min_width ?? null,
      payload.max_width ?? null,
      payload.min_height ?? null,
      payload.max_height ?? null,
      payload.padding ? JSON.stringify(payload.padding) : null,
      payload.gap ?? null,
      payload.breakpoint ?? null,
      payload.breakpoints ? JSON.stringify(payload.breakpoints) : null,
      payload.z_index ?? null,
      payload.above ? JSON.stringify(payload.above) : null,
      now,
      now
    );
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      throw new PatternsError('DUPLICATE_GUIDELINE', `Guideline '${payload.name}' already exists`);
    }
    throw err;
  }

  return {
    id,
    pattern_id: patternId,
    name: payload.name,
    description: payload.description,
    min_width: payload.min_width,
    max_width: payload.max_width,
    min_height: payload.min_height,
    max_height: payload.max_height,
    padding: payload.padding,
    gap: payload.gap,
    breakpoint: payload.breakpoint,
    breakpoints: payload.breakpoints,
    z_index: payload.z_index,
    above: payload.above,
    created_at: now,
    updated_at: now,
  };
}

export async function listLayoutGuidelines(patternId: string): Promise<GuidelineResponse[]> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  const stmt = db.prepare('SELECT * FROM layout_guidelines WHERE pattern_id = ? ORDER BY created_at');
  const rows = stmt.all(patternId) as any[];

  return rows.map((row: any) => ({
    id: row.id,
    pattern_id: row.pattern_id,
    name: row.name,
    description: row.description,
    min_width: row.min_width,
    max_width: row.max_width,
    min_height: row.min_height,
    max_height: row.max_height,
    padding: row.padding ? JSON.parse(row.padding) : undefined,
    gap: row.gap,
    breakpoint: row.breakpoint,
    breakpoints: row.breakpoints ? JSON.parse(row.breakpoints) : undefined,
    z_index: row.z_index,
    above: row.above ? JSON.parse(row.above) : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getLayoutGuideline(
  patternId: string,
  guidelineId: string
): Promise<GuidelineResponse> {
  const db = getDb();

  // Verify pattern exists
  await getPattern(patternId);

  const stmt = db.prepare(
    'SELECT * FROM layout_guidelines WHERE pattern_id = ? AND id = ?'
  );
  const row = stmt.get(patternId, guidelineId) as any;

  if (!row) {
    throw new PatternsError('GUIDELINE_NOT_FOUND', 'Layout guideline not found');
  }

  return {
    id: row.id,
    pattern_id: row.pattern_id,
    name: row.name,
    description: row.description,
    min_width: row.min_width,
    max_width: row.max_width,
    min_height: row.min_height,
    max_height: row.max_height,
    padding: row.padding ? JSON.parse(row.padding) : undefined,
    gap: row.gap,
    breakpoint: row.breakpoint,
    breakpoints: row.breakpoints ? JSON.parse(row.breakpoints) : undefined,
    z_index: row.z_index,
    above: row.above ? JSON.parse(row.above) : undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function updateLayoutGuideline(
  patternId: string,
  guidelineId: string,
  payload: Partial<{
    name: string;
    description: string;
    min_width: number;
    max_width: number;
    min_height: number;
    max_height: number;
    padding: Record<string, number>;
    gap: number;
    breakpoint: number;
    breakpoints: Array<Record<string, any>>;
    z_index: number;
    above: string[];
  }>
): Promise<GuidelineResponse> {
  const db = getDb();

  // Get existing guideline
  const existing = await getLayoutGuideline(patternId, guidelineId);

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
  if (payload.min_width !== undefined) {
    updates.push('min_width = ?');
    values.push(payload.min_width);
  }
  if (payload.max_width !== undefined) {
    updates.push('max_width = ?');
    values.push(payload.max_width);
  }
  if (payload.min_height !== undefined) {
    updates.push('min_height = ?');
    values.push(payload.min_height);
  }
  if (payload.max_height !== undefined) {
    updates.push('max_height = ?');
    values.push(payload.max_height);
  }
  if (payload.padding !== undefined) {
    updates.push('padding = ?');
    values.push(JSON.stringify(payload.padding));
  }
  if (payload.gap !== undefined) {
    updates.push('gap = ?');
    values.push(payload.gap);
  }
  if (payload.breakpoint !== undefined) {
    updates.push('breakpoint = ?');
    values.push(payload.breakpoint);
  }
  if (payload.breakpoints !== undefined) {
    updates.push('breakpoints = ?');
    values.push(JSON.stringify(payload.breakpoints));
  }
  if (payload.z_index !== undefined) {
    updates.push('z_index = ?');
    values.push(payload.z_index);
  }
  if (payload.above !== undefined) {
    updates.push('above = ?');
    values.push(JSON.stringify(payload.above));
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(patternId);
  values.push(guidelineId);

  const sql = `UPDATE layout_guidelines SET ${updates.join(', ')} WHERE pattern_id = ? AND id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getLayoutGuideline(patternId, guidelineId);
}

export async function deleteLayoutGuideline(patternId: string, guidelineId: string): Promise<void> {
  const db = getDb();

  // Verify guideline exists
  await getLayoutGuideline(patternId, guidelineId);

  const stmt = db.prepare('DELETE FROM layout_guidelines WHERE pattern_id = ? AND id = ?');
  stmt.run(patternId, guidelineId);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export async function validatePattern(pattern: any): Promise<{ status: 'valid' | 'invalid'; errors?: string[] }> {
  const errors: string[] = [];

  // Check required fields
  if (!pattern.name) errors.push('name is required');
  if (!pattern.description) errors.push('description is required');
  if (!pattern.category) errors.push('category is required');
  if (!pattern.version) errors.push('version is required');

  // Validate version format (X.Y.Z)
  if (pattern.version && !/^\d+\.\d+\.\d+$/.test(pattern.version)) {
    errors.push('version must match pattern ^[0-9]+\\.[0-9]+\\.[0-9]+$');
  }

  // Validate category enum
  const validCategories = ['component', 'container', 'layout', 'primitive'];
  if (pattern.category && !validCategories.includes(pattern.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`);
  }

  if (errors.length > 0) {
    return { status: 'invalid', errors };
  }

  return { status: 'valid' };
}

export async function validatePatternBatch(patterns: any[]): Promise<{
  results: Array<{ valid: boolean; error?: string }>;
}> {
  const results = await Promise.all(
    patterns.map(async (pattern) => {
      const validation = await validatePattern(pattern);
      if (validation.status === 'valid') {
        return { valid: true };
      }
      return { valid: false, error: validation.errors?.join('; ') };
    })
  );

  return { results };
}

export async function lintPattern(pattern: any): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];

  // Warn about kebab-case naming convention
  if (pattern.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pattern.name)) {
    warnings.push('name should use kebab-case');
  }

  // Warn about description length
  if (pattern.description && pattern.description.length < 10) {
    warnings.push('description is too short');
  }

  return { warnings };
}
