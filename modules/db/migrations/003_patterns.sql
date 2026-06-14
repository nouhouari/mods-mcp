-- 003_patterns.sql
-- Pattern library schema with patterns, variants, composition rules, and layout guidelines
-- Applied by runMigrations() — do not add PRAGMAs here.

-- Patterns table
CREATE TABLE IF NOT EXISTS patterns (
    id          TEXT NOT NULL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    category    TEXT NOT NULL,
    version     TEXT NOT NULL,
    schema_json TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Pattern variants
CREATE TABLE IF NOT EXISTS pattern_variants (
    id          TEXT NOT NULL PRIMARY KEY,
    pattern_id  TEXT NOT NULL REFERENCES patterns (id) ON DELETE CASCADE ON UPDATE CASCADE,
    name        TEXT NOT NULL,
    props       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (pattern_id, name)
);

-- Composition rules (parent -> child relationships between patterns)
CREATE TABLE IF NOT EXISTS composition_rules (
    id          TEXT NOT NULL PRIMARY KEY,
    parent_id   TEXT NOT NULL REFERENCES patterns (id) ON DELETE CASCADE ON UPDATE CASCADE,
    child_id    TEXT NOT NULL REFERENCES patterns (id) ON DELETE CASCADE ON UPDATE CASCADE,
    relationship TEXT NOT NULL,
    cardinality TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (parent_id, child_id, relationship)
);

-- Layout guidelines for patterns
CREATE TABLE IF NOT EXISTS layout_guidelines (
    id          TEXT NOT NULL PRIMARY KEY,
    pattern_id  TEXT NOT NULL REFERENCES patterns (id) ON DELETE CASCADE ON UPDATE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    min_width   INTEGER,
    max_width   INTEGER,
    min_height  INTEGER,
    max_height  INTEGER,
    padding     TEXT,
    gap         INTEGER,
    breakpoint  INTEGER,
    breakpoints TEXT,
    z_index     INTEGER,
    above       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (pattern_id, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pattern_variants_pattern_id   ON pattern_variants (pattern_id);
CREATE INDEX IF NOT EXISTS idx_composition_rules_parent_id   ON composition_rules (parent_id);
CREATE INDEX IF NOT EXISTS idx_composition_rules_child_id    ON composition_rules (child_id);
CREATE INDEX IF NOT EXISTS idx_layout_guidelines_pattern_id  ON layout_guidelines (pattern_id);
CREATE INDEX IF NOT EXISTS idx_patterns_category            ON patterns (category);
