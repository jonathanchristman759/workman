// Workman — db/mod.rs
// src-tauri/src/db/mod.rs
// SQLite database initialisation and migration runner.
// Uses rusqlite with the bundled SQLite feature so there are
// no system library dependencies on any platform.

pub mod seed;

use rusqlite::Connection;
use std::path::Path;
use crate::error::{AppError, Result};

// ─────────────────────────────────────────────
// PRAGMAS
// Applied once on every connection open.
// WAL mode: better concurrent read performance.
// foreign_keys: enforces FK constraints (SQLite disables them by default).
// ─────────────────────────────────────────────

const PRAGMAS: &str = "
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -8000;
    PRAGMA temp_store = MEMORY;
";

// ─────────────────────────────────────────────
// SCHEMA
// All tables defined in a single CREATE IF NOT EXISTS block.
// This acts as an idempotent migration — safe to run on every launch.
// For schema changes post-release, add ALTER TABLE statements
// gated on a user_version check below.
// ─────────────────────────────────────────────

const SCHEMA: &str = "
-- Settings (single row — one pastor per install)
CREATE TABLE IF NOT EXISTS settings (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    name            TEXT    NOT NULL DEFAULT '',
    church          TEXT,
    denomination    TEXT,
    language        TEXT    NOT NULL DEFAULT 'EN',
    theme           TEXT    NOT NULL DEFAULT 'parchment',
    editor_font_size INTEGER NOT NULL DEFAULT 16,
    logos_connected INTEGER NOT NULL DEFAULT 0,
    logos_token     TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Insert the default settings row if not present
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- Series
CREATE TABLE IF NOT EXISTS series (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sermons
CREATE TABLE IF NOT EXISTS sermons (
    id            TEXT PRIMARY KEY,
    series_id     TEXT REFERENCES series(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,
    passage_ref   TEXT NOT NULL,
    book          TEXT,
    chapter_start INTEGER,
    chapter_end   INTEGER,
    mode          TEXT NOT NULL DEFAULT 'OUTLINE',
    outline_json  TEXT,
    manuscript    TEXT,
    notes         TEXT,
    word_count    INTEGER NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'DRAFT',
    delivery_date TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sermons_book          ON sermons(book);
CREATE INDEX IF NOT EXISTS idx_sermons_status        ON sermons(status);
CREATE INDEX IF NOT EXISTS idx_sermons_delivery_date ON sermons(delivery_date);

-- Full-text search for sermons
CREATE VIRTUAL TABLE IF NOT EXISTS sermons_fts USING fts5(
    id UNINDEXED,
    title,
    passage_ref,
    manuscript,
    notes,
    content='sermons',
    content_rowid='rowid'
);

-- Sermon version history
CREATE TABLE IF NOT EXISTS sermon_versions (
    id            TEXT PRIMARY KEY,
    sermon_id     TEXT NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    snapshot_json TEXT NOT NULL,
    saved_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sermon_versions_sermon_id ON sermon_versions(sermon_id);

-- Sermon media attachments
CREATE TABLE IF NOT EXISTS sermon_media (
    id          TEXT PRIMARY KEY,
    sermon_id   TEXT NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    media_type  TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    filename    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Illustrations
CREATE TABLE IF NOT EXISTS illustrations (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    source      TEXT,
    language    TEXT NOT NULL DEFAULT 'EN',
    is_custom   INTEGER NOT NULL DEFAULT 0,
    is_favorited INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_illustrations_language ON illustrations(language);

-- Full-text search for illustrations
CREATE VIRTUAL TABLE IF NOT EXISTS illustrations_fts USING fts5(
    id UNINDEXED,
    title,
    body,
    content='illustrations',
    content_rowid='rowid'
);

-- Illustration tags
CREATE TABLE IF NOT EXISTS illustration_tags (
    id              TEXT PRIMARY KEY,
    illustration_id TEXT NOT NULL REFERENCES illustrations(id) ON DELETE CASCADE,
    tag             TEXT NOT NULL,
    category        TEXT
);

CREATE INDEX IF NOT EXISTS idx_illustration_tags_illustration_id ON illustration_tags(illustration_id);
CREATE INDEX IF NOT EXISTS idx_illustration_tags_tag             ON illustration_tags(tag);

-- Bible verses (KJV + RVR60)
CREATE TABLE IF NOT EXISTS bible_verses (
    id          TEXT PRIMARY KEY,
    translation TEXT NOT NULL,
    book        TEXT NOT NULL,
    book_number INTEGER NOT NULL,
    chapter     INTEGER NOT NULL,
    verse       INTEGER NOT NULL,
    text        TEXT NOT NULL,
    UNIQUE(translation, book, chapter, verse)
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_location ON bible_verses(translation, book, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_bible_verses_book_num ON bible_verses(book_number);

-- Full-text search for Bible verses
CREATE VIRTUAL TABLE IF NOT EXISTS bible_fts USING fts5(
    id UNINDEXED,
    text,
    content='bible_verses',
    content_rowid='rowid'
);

-- Lexicon words (Strong's)
CREATE TABLE IF NOT EXISTS lexicon_words (
    id              TEXT PRIMARY KEY,
    strongs_number  TEXT NOT NULL UNIQUE,
    language        TEXT NOT NULL,
    original_word   TEXT NOT NULL,
    transliteration TEXT NOT NULL,
    pronunciation   TEXT,
    part_of_speech  TEXT,
    glosses         TEXT NOT NULL DEFAULT '[]',
    definition      TEXT,
    nt_ot_count     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_lexicon_words_strongs  ON lexicon_words(strongs_number);
CREATE INDEX IF NOT EXISTS idx_lexicon_words_language ON lexicon_words(language);

-- Lexicon occurrences (where each word appears)
CREATE TABLE IF NOT EXISTS lexicon_occurrences (
    id            TEXT PRIMARY KEY,
    word_id       TEXT NOT NULL REFERENCES lexicon_words(id) ON DELETE CASCADE,
    book          TEXT NOT NULL,
    chapter       INTEGER NOT NULL,
    verse         INTEGER NOT NULL,
    kjv_rendering TEXT NOT NULL,
    parsing       TEXT
);

CREATE INDEX IF NOT EXISTS idx_lexicon_occ_word_id  ON lexicon_occurrences(word_id);
CREATE INDEX IF NOT EXISTS idx_lexicon_occ_location ON lexicon_occurrences(book, chapter, verse);

-- Lexicon bookmarks (pastor's saved words)
CREATE TABLE IF NOT EXISTS lexicon_bookmarks (
    id              TEXT PRIMARY KEY,
    strongs_number  TEXT NOT NULL UNIQUE,
    original_word   TEXT NOT NULL,
    transliteration TEXT,
    language        TEXT NOT NULL,
    passage_ref     TEXT,
    note            TEXT,
    saved_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Import jobs
CREATE TABLE IF NOT EXISTS import_jobs (
    id              TEXT PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    total_files     INTEGER NOT NULL DEFAULT 0,
    completed_files INTEGER NOT NULL DEFAULT 0,
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);

-- Import items
CREATE TABLE IF NOT EXISTS import_items (
    id                TEXT PRIMARY KEY,
    job_id            TEXT NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    sermon_id         TEXT UNIQUE REFERENCES sermons(id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    file_format       TEXT NOT NULL,
    extracted_text    TEXT,
    review_status     TEXT NOT NULL DEFAULT 'PENDING',
    imported_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_import_items_job_id ON import_items(job_id);
";

// ─────────────────────────────────────────────
// TRIGGERS
// updated_at auto-maintenance for mutable tables
// ─────────────────────────────────────────────

const TRIGGERS: &str = "
CREATE TRIGGER IF NOT EXISTS trg_sermons_updated_at
    AFTER UPDATE ON sermons
    FOR EACH ROW
    BEGIN
        UPDATE sermons SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS trg_series_updated_at
    AFTER UPDATE ON series
    FOR EACH ROW
    BEGIN
        UPDATE series SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS trg_settings_updated_at
    AFTER UPDATE ON settings
    FOR EACH ROW
    BEGIN
        UPDATE settings SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS trg_illustrations_updated_at
    AFTER UPDATE ON illustrations
    FOR EACH ROW
    BEGIN
        UPDATE illustrations SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

-- FTS sync triggers for sermons
CREATE TRIGGER IF NOT EXISTS trg_sermons_fts_insert AFTER INSERT ON sermons BEGIN
    INSERT INTO sermons_fts(rowid, id, title, passage_ref, manuscript, notes)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.passage_ref, NEW.manuscript, NEW.notes);
END;
CREATE TRIGGER IF NOT EXISTS trg_sermons_fts_delete AFTER DELETE ON sermons BEGIN
    INSERT INTO sermons_fts(sermons_fts, rowid, id, title, passage_ref, manuscript, notes)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.passage_ref, OLD.manuscript, OLD.notes);
END;
CREATE TRIGGER IF NOT EXISTS trg_sermons_fts_update AFTER UPDATE ON sermons BEGIN
    INSERT INTO sermons_fts(sermons_fts, rowid, id, title, passage_ref, manuscript, notes)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.passage_ref, OLD.manuscript, OLD.notes);
    INSERT INTO sermons_fts(rowid, id, title, passage_ref, manuscript, notes)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.passage_ref, NEW.manuscript, NEW.notes);
END;

-- FTS sync triggers for illustrations
CREATE TRIGGER IF NOT EXISTS trg_ill_fts_insert AFTER INSERT ON illustrations BEGIN
    INSERT INTO illustrations_fts(rowid, id, title, body) VALUES (NEW.rowid, NEW.id, NEW.title, NEW.body);
END;
CREATE TRIGGER IF NOT EXISTS trg_ill_fts_delete AFTER DELETE ON illustrations BEGIN
    INSERT INTO illustrations_fts(illustrations_fts, rowid, id, title, body)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.body);
END;
CREATE TRIGGER IF NOT EXISTS trg_ill_fts_update AFTER UPDATE ON illustrations BEGIN
    INSERT INTO illustrations_fts(illustrations_fts, rowid, id, title, body)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.body);
    INSERT INTO illustrations_fts(rowid, id, title, body) VALUES (NEW.rowid, NEW.id, NEW.title, NEW.body);
END;
";

// ─────────────────────────────────────────────
// PUBLIC INIT FUNCTION
// ─────────────────────────────────────────────

/// Open (or create) the SQLite database at the given path,
/// apply pragmas, create tables, and set up triggers.
pub fn init(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Apply connection pragmas
    conn.execute_batch(PRAGMAS)
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Create tables
    conn.execute_batch(SCHEMA)
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Create triggers
    conn.execute_batch(TRIGGERS)
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(conn)
}

// ─────────────────────────────────────────────
// HELPERS — used by command modules
// ─────────────────────────────────────────────

/// Generate a new UUID v4 string
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Get current UTC datetime as ISO 8601 string
pub fn now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}
