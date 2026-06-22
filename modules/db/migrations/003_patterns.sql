-- 003_patterns.sql
-- Pattern library schema with patterns, variants, composition rules, and layout guidelines
-- Applied by runMigrations() — do not add PRAGMAs here.

-- Patterns table (contract-aligned: project-scoped, includes tags and guidanceUrl)
CREATE TABLE IF NOT EXISTS patterns (
    id                  TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    description         TEXT,
    tags                TEXT,                 -- JSON array of strings
    guidance_url        TEXT,                 -- optional URL string
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    PRIMARY KEY (id, project_id),
    UNIQUE (id, project_id)
);

-- Pattern variants (contract-aligned: has variant ID, appliesAt instead of props)
CREATE TABLE IF NOT EXISTS pattern_variants (
    id                  TEXT NOT NULL PRIMARY KEY,
    pattern_id          TEXT NOT NULL,
    project_id          TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    applies_at          TEXT NOT NULL,        -- breakpoint context: mobile, tablet, desktop, etc.
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    FOREIGN KEY (pattern_id, project_id) REFERENCES patterns (id, project_id) ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE (pattern_id, project_id, name)
);

-- Composition rules (contract-aligned: patternA/patternB with relation enum)
CREATE TABLE IF NOT EXISTS composition_rules (
    id                  TEXT NOT NULL PRIMARY KEY,
    project_id          TEXT NOT NULL,
    pattern_a_id        TEXT NOT NULL,
    pattern_b_id        TEXT NOT NULL,
    relation            TEXT NOT NULL,        -- enum: NESTING_ALLOWED, NESTING_FORBIDDEN, OVERRIDE_CAUTION, SIBLING_ONLY, EXCLUSIVE
    guidance            TEXT,                 -- optional guidance text
    created_at          TEXT NOT NULL,
    UNIQUE (project_id, pattern_a_id, pattern_b_id, relation)
);

-- Layout guidelines for project-level design system rules (not pattern-scoped)
CREATE TABLE IF NOT EXISTS layout_guidelines (
    id                  TEXT NOT NULL PRIMARY KEY,
    project_id          TEXT NOT NULL,
    type                TEXT NOT NULL,        -- enum: breakpoints, spacing, grid, alignment, typography, animation
    name                TEXT NOT NULL,
    description         TEXT,
    data                TEXT NOT NULL,        -- JSON object containing guideline-specific structure
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    UNIQUE (project_id, type, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pattern_variants_pattern_id   ON pattern_variants (pattern_id, project_id);
CREATE INDEX IF NOT EXISTS idx_composition_rules_pattern_a_id ON composition_rules (pattern_a_id, project_id);
CREATE INDEX IF NOT EXISTS idx_composition_rules_pattern_b_id ON composition_rules (pattern_b_id, project_id);
CREATE INDEX IF NOT EXISTS idx_layout_guidelines_project_id  ON layout_guidelines (project_id);
CREATE INDEX IF NOT EXISTS idx_patterns_project_id           ON patterns (project_id);
CREATE INDEX IF NOT EXISTS idx_patterns_category             ON patterns (category, project_id);
