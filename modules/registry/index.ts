import Database from 'better-sqlite3';
import { getDb } from '../db/index';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class RegistryError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = 'RegistryError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? null,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createProject(input: { id: string; name: string; parentId?: string | null }): Promise<Project> {
  const db = getDb();
  try {
    const { id, name, parentId } = input;

    if (parentId) {
      // Check parent exists
      const parent = db.prepare('SELECT * FROM projects WHERE id = ?').get(parentId) as any;
      if (!parent) {
        throw new RegistryError('PROJECT_NOT_FOUND', `Parent project '${parentId}' not found`);
      }
      // Check parent is not itself a child (grandchild prevention)
      if (parent.parent_id !== null && parent.parent_id !== undefined) {
        throw new RegistryError('MAX_INHERITANCE_DEPTH', 'Cannot create grandchild project');
      }
    }

    const createdAt = new Date().toISOString();
    try {
      db.prepare(
        'INSERT INTO projects (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)'
      ).run(id, name, parentId ?? null, createdAt);
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new RegistryError('DUPLICATE_PROJECT_ID', `Project id '${id}' already exists`);
      }
      throw err;
    }

    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    return rowToProject(row);
  } finally {
    db.close();
  }
}

export async function getProject(id: string): Promise<Project> {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!row) {
      throw new RegistryError('PROJECT_NOT_FOUND', `Project '${id}' not found`);
    }
    return rowToProject(row);
  } finally {
    db.close();
  }
}

export async function listProjects(): Promise<Project[]> {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as any[];
    return rows.map(rowToProject);
  } finally {
    db.close();
  }
}

export async function updateProject(id: string, input: { name?: string }): Promise<Project> {
  const db = getDb();
  try {
    // Check exists first
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!existing) {
      throw new RegistryError('PROJECT_NOT_FOUND', `Project '${id}' not found`);
    }

    if (input.name !== undefined) {
      db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(input.name, id);
    }

    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    return rowToProject(row);
  } finally {
    db.close();
  }
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDb();
  try {
    // Check exists first
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!existing) {
      throw new RegistryError('PROJECT_NOT_FOUND', `Project '${id}' not found`);
    }

    // Check for child projects (BASE_HAS_CHILDREN)
    const children = db.prepare('SELECT id FROM projects WHERE parent_id = ?').get(id) as any;
    if (children) {
      throw new RegistryError('BASE_HAS_CHILDREN', `Project '${id}' has child projects`);
    }

    // Check for tokens (PROJECT_HAS_TOKENS)
    // The schema uses ON DELETE CASCADE for tokens, so we must check manually
    const tokenRow = db.prepare('SELECT id FROM tokens WHERE project_id = ? LIMIT 1').get(id) as any;
    if (tokenRow) {
      throw new RegistryError('PROJECT_HAS_TOKENS', `Project '${id}' has tokens attached`);
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  } finally {
    db.close();
  }
}

export async function isBase(id: string): Promise<boolean> {
  const project = await getProject(id);
  return project.parentId === null;
}
