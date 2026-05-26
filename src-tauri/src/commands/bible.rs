// Workman — commands/bible.rs
// src-tauri/src/commands/bible.rs

use serde::Serialize;
use tauri::State;
use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct BibleVerse {
    pub id:          String,
    pub translation: String,
    pub book:        String,
    pub book_number: i64,
    pub chapter:     i64,
    pub verse:       i64,
    pub text:        String,
}

#[tauri::command]
pub fn get_verse(
    state:       State<AppState>,
    translation: String,
    book:        String,
    chapter:     i64,
    verse:       i64,
) -> Result<BibleVerse> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    conn.query_row(
        "SELECT id, translation, book, book_number, chapter, verse, text
         FROM bible_verses
         WHERE translation = ?1 AND book = ?2 AND chapter = ?3 AND verse = ?4",
        rusqlite::params![translation, book, chapter, verse],
        |r| Ok(BibleVerse {
            id:          r.get(0)?,
            translation: r.get(1)?,
            book:        r.get(2)?,
            book_number: r.get(3)?,
            chapter:     r.get(4)?,
            verse:       r.get(5)?,
            text:        r.get(6)?,
        }),
    ).map_err(|_| AppError::NotFound(format!("{} {}:{} not found", book, chapter, verse)))
}

#[tauri::command]
pub fn get_passage(
    state:       State<AppState>,
    translation: String,
    book:        String,
    chapter:     i64,
) -> Result<Vec<BibleVerse>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, translation, book, book_number, chapter, verse, text
         FROM bible_verses
         WHERE translation = ?1 AND book = ?2 AND chapter = ?3
         ORDER BY verse"
    )?;

    let verses = stmt.query_map(rusqlite::params![translation, book, chapter], |r| {
        Ok(BibleVerse {
            id:          r.get(0)?,
            translation: r.get(1)?,
            book:        r.get(2)?,
            book_number: r.get(3)?,
            chapter:     r.get(4)?,
            verse:       r.get(5)?,
            text:        r.get(6)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(verses)
}

#[tauri::command]
pub fn search_verses(
    state:       State<AppState>,
    query:       String,
    translation: Option<String>,
) -> Result<Vec<BibleVerse>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let trans = translation.unwrap_or_else(|| "KJV".to_string());

    // Use FTS5 for fast full-text search across all Bible verses
    let mut stmt = conn.prepare(
        "SELECT v.id, v.translation, v.book, v.book_number, v.chapter, v.verse, v.text
         FROM bible_verses v
         JOIN bible_fts f ON f.id = v.id
         WHERE bible_fts MATCH ?1 AND v.translation = ?2
         ORDER BY rank
         LIMIT 50"
    )?;

    let verses = stmt.query_map(rusqlite::params![query, trans], |r| {
        Ok(BibleVerse {
            id:          r.get(0)?,
            translation: r.get(1)?,
            book:        r.get(2)?,
            book_number: r.get(3)?,
            chapter:     r.get(4)?,
            verse:       r.get(5)?,
            text:        r.get(6)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(verses)
}

#[tauri::command]
pub fn get_chapter_count(
    state:       State<AppState>,
    translation: String,
    book:        String,
) -> Result<i64> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    conn.query_row(
        "SELECT MAX(chapter) FROM bible_verses WHERE translation = ?1 AND book = ?2",
        rusqlite::params![translation, book],
        |r| r.get(0),
    ).map_err(|_| AppError::NotFound(format!("{} not found", book)))
}