import Database from 'better-sqlite3';
import { readdirSync, readFileSync, realpathSync } from 'fs';
import * as path from 'path';

import * as os from 'os';

// Compute allowed path prefixes at module load — includes the real tmpdir
// (on macOS, os.tmpdir() is /var/folders/…, not /tmp/)
// HOME must be non-empty before being added: an empty HOME would produce '/'
// which matches every absolute path and defeats the allowlist.
function _tryRealpath(p: string): string {
  try { return realpathSync(p); } catch { return p; }
}

const _home = process.env.HOME;
const ALLOWED_DB_PATH_PREFIXES = [
  '/tmp/', _tryRealpath('/tmp') + '/',
  path.resolve('/tmp') + '/',
  os.tmpdir() + '/', _tryRealpath(os.tmpdir()) + '/',
  ...(_home ? [_home + '/', _tryRealpath(_home) + '/'] : []),
].filter((v, i, a) => a.indexOf(v) === i);

function validateDbPath(raw: string): string {
  if (raw === ':memory:') return raw;
  const resolved = path.resolve(raw);
  // Resolve symlinks to prevent symlink escape (e.g. ~/mpds.db -> /etc/shadow).
  // Fall back to path.resolve when the path doesn't exist yet (new DB file).
  const realResolved = _tryRealpath(resolved);
  if (!ALLOWED_DB_PATH_PREFIXES.some(p => realResolved.startsWith(p))) {
    throw new Error(`DB_PATH not allowed: ${raw}`);
  }
  return resolved;
}

const DB_PATH = (): string => {
  if (!process.env.DB_PATH) throw new Error('DB_PATH must be set in production');
  return validateDbPath(process.env.DB_PATH);
};

// Module-level singleton
let _db: Database.Database | undefined;

export function getDb(): Database.Database {
  // If the singleton was closed externally (by a module's finally block),
  // clear it so we re-open at the current DB_PATH.
  if (_db && !_db.open) {
    _db = undefined;
  }
  if (_db) return _db;
  _db = new Database(DB_PATH());
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  return _db;
}

export function resetDb(): void {
  if (_db) {
    try { _db.close(); } catch (_) {}
    _db = undefined;
  }
}

export function runMigrations(db: Database.Database): void {
  // 1. Ensure the migrations tracking table exists (not part of migration files)
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version    INTEGER NOT NULL,
      applied_at TEXT    NOT NULL,
      PRIMARY KEY (version)
    )
  `);

  // 2. Scan modules/db/migrations/ for NNN_*.sql files, sorted numerically
  const migrationsDir = path.join(__dirname, 'migrations');
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter(f => /^\d+_.*\.sql$/.test(f))
      .sort(); // lexicographic sort works because filenames are zero-padded NNN_
  } catch (e) {
    // A missing migrations directory means the build/packaging is broken
    // (e.g. .sql files not copied next to the compiled JS). Fail loudly
    // instead of silently starting with an empty schema.
    throw new Error(
      `Migrations directory not found at ${migrationsDir}. ` +
        `Ensure migration .sql files are packaged alongside the compiled output.`
    );
  }

  // 3. Apply only unapplied migrations
  const getApplied = db.prepare('SELECT version FROM migrations WHERE version = ?');
  const recordApplied = db.prepare(
    'INSERT INTO migrations (version, applied_at) VALUES (?, ?)'
  );

  for (const file of files) {
    // Extract numeric version from filename prefix (e.g. "001" -> 1)
    const versionStr = file.match(/^(\d+)_/)![1];
    const version = parseInt(versionStr, 10);

    const already = getApplied.get(version);
    if (already) continue; // idempotent — skip already-applied

    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
    recordApplied.run(version, new Date().toISOString());
  }
}
