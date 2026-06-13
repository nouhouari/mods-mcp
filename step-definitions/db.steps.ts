import { Given, When, Then } from '@cucumber/cucumber';
import * as assert from 'assert';
import { MpdsWorld } from '../support/world';

// ---------------------------------------------------------------------------
// Given steps — US-016 / US-017 db-bootstrap
// ---------------------------------------------------------------------------

/**
 * No-op: the Before hook in world.ts already opened the DB via getDb() and
 * ran runMigrations(), storing the connection in this.db.
 */
Given('I have opened the database', function (this: MpdsWorld) {
  assert.ok(this.db, 'Expected this.db to be initialized by the Before hook');
});

// ---------------------------------------------------------------------------
// When steps — US-016 singleton
// ---------------------------------------------------------------------------

When('I call getDb a second time in the same scenario', function (this: MpdsWorld) {
  // Do NOT import at module load time — the singleton must be reset per
  // scenario by the Before hook (which sets process.env.DB_PATH fresh each time).
  const dbModule = require('../modules/db/index');
  const secondDb = dbModule.getDb();
  this.secondResult = secondDb;
});

// ---------------------------------------------------------------------------
// Then steps — US-016 singleton
// ---------------------------------------------------------------------------

Then('the second call returns the same database instance', function (this: MpdsWorld) {
  assert.ok(this.db, 'Expected this.db to be set');
  assert.ok(this.secondResult, 'Expected secondResult to be set');
  assert.strictEqual(
    this.db,
    this.secondResult,
    'Expected getDb() to return the same singleton instance on second call'
  );
});

// ---------------------------------------------------------------------------
// When steps — US-016 PRAGMAs
// ---------------------------------------------------------------------------

When('I check the journal_mode pragma', function (this: MpdsWorld) {
  this.lastResult = this.db.pragma('journal_mode', { simple: true });
});

When('I check the foreign_keys pragma', function (this: MpdsWorld) {
  this.lastResult = this.db.pragma('foreign_keys', { simple: true });
});

When('I check the busy_timeout pragma', function (this: MpdsWorld) {
  this.lastResult = this.db.pragma('busy_timeout', { simple: true });
});

// ---------------------------------------------------------------------------
// Then steps — US-016 PRAGMAs
// ---------------------------------------------------------------------------

Then('the journal_mode is {string}', function (this: MpdsWorld, expected: string) {
  assert.strictEqual(
    this.lastResult,
    expected,
    `Expected journal_mode to be '${expected}' but got '${this.lastResult}'`
  );
});

Then('the foreign_keys value is {int}', function (this: MpdsWorld, expected: number) {
  assert.strictEqual(
    this.lastResult,
    expected,
    `Expected foreign_keys to be ${expected} but got ${this.lastResult}`
  );
});

Then('the busy_timeout value is {int}', function (this: MpdsWorld, expected: number) {
  assert.strictEqual(
    this.lastResult,
    expected,
    `Expected busy_timeout to be ${expected} but got ${this.lastResult}`
  );
});

// ---------------------------------------------------------------------------
// When steps — US-017 migrations
// ---------------------------------------------------------------------------

When('I query the migrations table', function (this: MpdsWorld) {
  this.lastResult = this.db.prepare('SELECT * FROM migrations').all();
});

When('I count migrations before calling runMigrations again', function (this: MpdsWorld) {
  const row = this.db.prepare('SELECT COUNT(*) as cnt FROM migrations').get() as { cnt: number };
  this.lastResult = row.cnt;
});

When('I call runMigrations a second time', function (this: MpdsWorld) {
  const dbModule = require('../modules/db/index');
  dbModule.runMigrations(this.db);
});

When('I query sqlite_master for table {string}', function (this: MpdsWorld, tableName: string) {
  this.lastResult = this.db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName);
});

When('I query sqlite_master for trigger {string}', function (this: MpdsWorld, triggerName: string) {
  this.lastResult = this.db
    .prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?")
    .get(triggerName);
});

// ---------------------------------------------------------------------------
// Then steps — US-017 migrations
// ---------------------------------------------------------------------------

Then('at least one migration row exists', function (this: MpdsWorld) {
  const rows = this.lastResult as unknown[];
  assert.ok(Array.isArray(rows), 'Expected migrations query to return an array');
  assert.ok(
    rows.length >= 1,
    `Expected at least one row in migrations table but got ${rows.length}`
  );
});

Then('each migration row has a version and applied_at', function (this: MpdsWorld) {
  const rows = this.lastResult as Array<{ version: unknown; applied_at: unknown }>;
  assert.ok(Array.isArray(rows), 'Expected migrations query to return an array');
  for (const row of rows) {
    assert.ok(
      row.version !== undefined && row.version !== null,
      `Row is missing 'version': ${JSON.stringify(row)}`
    );
    assert.ok(
      row.applied_at !== undefined && row.applied_at !== null,
      `Row is missing 'applied_at': ${JSON.stringify(row)}`
    );
  }
});

Then('the migrations count has not increased', function (this: MpdsWorld) {
  const before = this.lastResult as number;
  const after = (
    this.db.prepare('SELECT COUNT(*) as cnt FROM migrations').get() as { cnt: number }
  ).cnt;
  // The count must be >= 1 (proving migrations are tracked, not just empty)
  assert.ok(after >= 1, `Expected at least 1 tracked migration but found ${after}`);
  assert.strictEqual(
    after,
    before,
    `Expected migrations count to stay at ${before} after second runMigrations call but got ${after}`
  );
});

Then('the table exists', function (this: MpdsWorld) {
  assert.ok(
    this.lastResult !== undefined && this.lastResult !== null,
    'Expected table to exist in sqlite_master but query returned no row'
  );
});

Then('the trigger exists', function (this: MpdsWorld) {
  assert.ok(
    this.lastResult !== undefined && this.lastResult !== null,
    'Expected trigger to exist in sqlite_master but query returned no row'
  );
});
