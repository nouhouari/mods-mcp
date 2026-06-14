import { setWorldConstructor, Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

setDefaultTimeout(30_000);

export class MpdsWorld {
  /**
   * `db` is a live-connection getter: it calls getDb() each time so that
   * even if a module's finally-block closed the singleton, the next access
   * re-opens it at the current DB_PATH.
   */
  get db(): Database.Database {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../modules/db/index').getDb();
  }

  // Kept for compatibility with step-defs that assign to this.db (none should,
  // but the setter silently absorbs any stray assignment).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  set db(_value: Database.Database) {
    // no-op: getDb() is the authoritative source
  }

  dbPath!: string;
  lastResult: unknown = null;
  lastError: unknown = null;
  secondResult: unknown = null;
  lastStatus: number = 0;
  lastResponse: any = null;
  lastPatternId: string | null = null;
  lastRuleId: string | null = null;
  lastGuidelineId: string | null = null;
  patternMap: Map<string, string> | null = null;

  constructor() {}
}

setWorldConstructor(MpdsWorld);

Before(async function (this: MpdsWorld) {
  this.dbPath = path.join(
    os.tmpdir(),
    `mpds-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  );
  // Reset singleton first so this scenario gets a fresh DB at its unique path
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dbModule = require('../modules/db/index');
  dbModule.resetDb();
  process.env.DB_PATH = this.dbPath;
  // Open the singleton and run migrations; the getter keeps it accessible
  const db = dbModule.getDb();
  dbModule.runMigrations(db);
});

After(async function (this: MpdsWorld) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dbModule = require('../modules/db/index');
    dbModule.resetDb();
  } catch (_) {}
  try {
    if (this.dbPath && fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
    }
  } catch (_) {}
  delete process.env.DB_PATH;
});
