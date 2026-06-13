-- 002_guidelines.sql
-- Design guidelines storage with FTS5 full-text search

CREATE TABLE IF NOT EXISTS guidelines (
    id          TEXT NOT NULL PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS guidelines_fts
    USING fts5(title, body, tags, content='guidelines', content_rowid='rowid');

CREATE TRIGGER IF NOT EXISTS guidelines_fts_insert
    AFTER INSERT ON guidelines
    BEGIN
        INSERT INTO guidelines_fts(rowid, title, body, tags)
        VALUES (new.rowid, new.title, new.body, new.tags);
    END;

CREATE TRIGGER IF NOT EXISTS guidelines_fts_delete
    AFTER DELETE ON guidelines
    BEGIN
        INSERT INTO guidelines_fts(guidelines_fts, rowid, title, body, tags)
        VALUES ('delete', old.rowid, old.title, old.body, old.tags);
    END;

CREATE TRIGGER IF NOT EXISTS guidelines_fts_update
    AFTER UPDATE ON guidelines
    BEGIN
        INSERT INTO guidelines_fts(guidelines_fts, rowid, title, body, tags)
        VALUES ('delete', old.rowid, old.title, old.body, old.tags);
        INSERT INTO guidelines_fts(rowid, title, body, tags)
        VALUES (new.rowid, new.title, new.body, new.tags);
    END;
