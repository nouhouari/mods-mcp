-- 004_expand_token_categories.sql
-- Widen the tokens.category CHECK constraint to include 'border', 'motion',
-- and 'other'. These were advertised by the MCP create_token tool and rendered
-- by generate_showcase, but rejected by both the app validator and this DB
-- constraint — forcing tokens to be mis-categorised. SQLite cannot ALTER a
-- CHECK in place, so we rebuild the table (data-preserving) and recreate its
-- triggers and indexes. Nothing references tokens via FK, so this is safe.

DROP TRIGGER IF EXISTS tokens_semantic_ref_insert;
DROP TRIGGER IF EXISTS tokens_semantic_ref_update;

CREATE TABLE tokens_new (
    id            INTEGER NOT NULL,
    project_id    TEXT    NOT NULL REFERENCES projects (id) ON DELETE CASCADE ON UPDATE CASCADE,
    key           TEXT    NOT NULL,
    category      TEXT    NOT NULL
                          CHECK (category IN ('color','spacing','typography','radius','shadow','breakpoint','border','motion','other')),
    value         TEXT    NOT NULL,
    is_semantic   INTEGER NOT NULL DEFAULT 0 CHECK (is_semantic IN (0, 1)),
    semantic_ref  TEXT,
    version       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id AUTOINCREMENT),
    UNIQUE (project_id, category, key)
);

INSERT INTO tokens_new (id, project_id, key, category, value, is_semantic, semantic_ref, version)
    SELECT id, project_id, key, category, value, is_semantic, semantic_ref, version FROM tokens;

DROP TABLE tokens;
ALTER TABLE tokens_new RENAME TO tokens;

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

CREATE INDEX IF NOT EXISTS idx_tokens_project_category ON tokens (project_id, category);
CREATE INDEX IF NOT EXISTS idx_tokens_project_key      ON tokens (project_id, key);
