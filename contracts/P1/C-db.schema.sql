-- =============================================================================
-- FROZEN CONTRACT: C-db Shared SQLite Persistence
-- Project:    MPDS-MCP (Multi Project Design System MCP Server)
-- Module:     C-db
-- File:       contracts/P1/C-db.schema.sql
-- Frozen:     2026-06-13
-- =============================================================================
--
-- AUTHORITY: This file is the single source of truth for the MPDS-MCP database
-- schema. No module other than C-db opens the SQLite file directly. All other
-- modules receive the connection via getDb().
--
-- OCC RULE: All OCC-protected tables carry `version INTEGER NOT NULL DEFAULT 0`.
--   UPDATE callers MUST use: UPDATE <t> SET ..., version=version+1 WHERE id=? AND version=?
--   A 0-row result = concurrent write won; surface error.code: CONFLICT to client.
--
-- MIGRATIONS: modules/db/migrations/*.sql (NNN_description.sql), forward-only,
--   applied by runMigrations(db) at startup. idempotent.
--
-- TypeScript contract:
--   export function getDb(): Database;          // returns WAL+FK singleton
--   export function runMigrations(db: Database): void;
--   const DB_PATH = process.env.DB_PATH ?? './data/mpds.db';
--
-- JSON columns: spec_json and similar TEXT columns store JSON. Callers:
--   JSON.stringify on write, JSON.parse on read. C-db validates before write.
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS migrations (
    version     INTEGER NOT NULL,
    applied_at  TEXT    NOT NULL,
    PRIMARY KEY (version)
);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT NOT NULL,
    name        TEXT NOT NULL,
    parent_id   TEXT REFERENCES projects (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS tokens (
    id            INTEGER NOT NULL,
    project_id    TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
    key           TEXT    NOT NULL,
    category      TEXT    NOT NULL
                          CHECK (category IN ('color','spacing','typography','radius','shadow','breakpoint')),
    value         TEXT    NOT NULL,
    is_semantic   INTEGER NOT NULL DEFAULT 0 CHECK (is_semantic IN (0, 1)),
    semantic_ref  TEXT,
    version       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id AUTOINCREMENT),
    UNIQUE (project_id, category, key)
);

-- Enforce semantic_ref referential integrity (self-referential, non-PK — cannot use FK).
CREATE TRIGGER IF NOT EXISTS tokens_semantic_ref_insert
BEFORE INSERT ON tokens FOR EACH ROW WHEN NEW.semantic_ref IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'tokens.semantic_ref does not match any key in this project')
    WHERE NOT EXISTS (SELECT 1 FROM tokens WHERE project_id = NEW.project_id AND key = NEW.semantic_ref);
END;

CREATE TRIGGER IF NOT EXISTS tokens_semantic_ref_update
BEFORE UPDATE OF semantic_ref ON tokens FOR EACH ROW WHEN NEW.semantic_ref IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'tokens.semantic_ref does not match any key in this project')
    WHERE NOT EXISTS (SELECT 1 FROM tokens WHERE project_id = NEW.project_id AND key = NEW.semantic_ref);
END;

CREATE TABLE IF NOT EXISTS component_specs (
    id          TEXT    NOT NULL,
    project_id  TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
    spec_json   TEXT    NOT NULL,
    version     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, project_id)
);

-- Explicit color-pair registry for WCAG contrast checking (REQ-026).
-- project_id NULL = org-wide pair; non-NULL = project-specific override.
CREATE TABLE IF NOT EXISTS token_pairs (
    id          TEXT NOT NULL,
    fg_key      TEXT NOT NULL,
    bg_key      TEXT NOT NULL,
    project_id  TEXT REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (id),
    UNIQUE (fg_key, bg_key, project_id)
);

CREATE TABLE IF NOT EXISTS proposals (
    id              TEXT    NOT NULL,
    project_id      TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
    token_key       TEXT    NOT NULL,
    proposed_value  TEXT    NOT NULL,
    rationale       TEXT,
    agent_id        TEXT,
    status          TEXT    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected')),
    decided_by      TEXT,
    decided_at      TEXT,
    rejection_note  TEXT,
    created_at      TEXT    NOT NULL,
    version         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

-- At most one pending proposal per (project, token_key).
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposals_pending_per_token
    ON proposals (project_id, token_key) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_projects_parent_id        ON projects (parent_id);
CREATE INDEX IF NOT EXISTS idx_tokens_project_category   ON tokens (project_id, category);
CREATE INDEX IF NOT EXISTS idx_tokens_project_key        ON tokens (project_id, key);
CREATE INDEX IF NOT EXISTS idx_component_specs_project   ON component_specs (project_id);
CREATE INDEX IF NOT EXISTS idx_token_pairs_project       ON token_pairs (project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_project_status  ON proposals (project_id, status);
