import { setWorldConstructor, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

setDefaultTimeout(30_000);

export class MpdsWorld {
  db!: Database.Database;
  dbPath!: string;
  lastResult: unknown = null;
  lastError: unknown = null;
  secondResult: unknown = null;

  constructor() {}
}

setWorldConstructor(MpdsWorld);

Before(async function (this: MpdsWorld) {
  // Create a unique temp file so each scenario gets its own isolated DB
  this.dbPath = path.join(
    os.tmpdir(),
    `mpds-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  process.env.DB_PATH = this.dbPath;

  // Import modules — they read process.env.DB_PATH fresh each call to getDb()
  // so setting it before calling getDb() is sufficient.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dbModule = require('../modules/db/index');
  this.db = dbModule.getDb();
  dbModule.runMigrations(this.db);
  this.db.close();
  // Re-open via getDb() so the db handle is fresh
  this.db = dbModule.getDb();
});

After(async function (this: MpdsWorld) {
  try {
    this.db?.close();
  } catch (_) {}
  try {
    if (this.dbPath && fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }
  } catch (_) {}
  delete process.env.DB_PATH;
});
