import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import * as path from 'path';

const DB_PATH = (): string => process.env.DB_PATH ?? './data/mpds.db';

/**
 * Return a new Database instance every call.
 * Tests use unique tmp paths per scenario — reading DB_PATH fresh each call
 * ensures each scenario gets its own isolated database.
 */
export function getDb(): Database.Database {
  const db = new Database(DB_PATH());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function runMigrations(db: Database.Database): void {
  // Schema file is at contracts/P1/C-db.schema.sql relative to repo root.
  // __dirname is modules/db/, so go up two levels to reach repo root.
  const schemaPath = path.join(__dirname, '..', '..', 'contracts', 'P1', 'C-db.schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf8');

  // Strip out PRAGMA lines and block comment header lines
  // then use db.exec() to run everything at once.
  // better-sqlite3 db.exec() handles multi-statement SQL correctly when
  // the SQL does not contain PRAGMA statements at the top level.
  //
  // We must remove PRAGMA lines because better-sqlite3's exec() does not
  // support PRAGMA inside a multi-statement exec call on some versions.
  const cleanedSql = schemaSql
    .split('\n')
    .filter((line) => !line.trim().toUpperCase().startsWith('PRAGMA'))
    .join('\n');

  db.exec(cleanedSql);
}
