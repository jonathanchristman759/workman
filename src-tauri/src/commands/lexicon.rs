// Workman — commands/lexicon.rs
// src-tauri/src/commands/lexicon.rs
// Everything from commands_lexicon_bible_settings.rs
// up to (but not including) the `pub mod bible` block.

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::new_id;
use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct LexiconWord {
    pub id:              String,
    pub strongs_number:  String,
    pub language:        String,
    pub original_word:   String,
    pub transliteration: String,
    pub pronunciation:   Option<String>,
    pub part_of_speech:  Option<String>,
    pub glosses:         Vec<String>,
    pub definition:      Option<String>,
    pub nt_ot_count:     Option<i64>,
    pub occurrences:     Vec<LexiconOccurrence>,
}

#[derive(Debug, Serialize, Clone)]
pub struct LexiconOccurrence {
    pub id:            String,
    pub word_id:       String,
    pub book:          String,
    pub chapter:       i64,
    pub verse:         i64,
    pub kjv_rendering: String,
    pub parsing:       Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InterlinearWord {
    pub kjv_rendering:    String,
    pub parsing:          Option<String>,
    pub strongs_number:   String,
    pub language:         String,
    pub original_word:    String,
    pub transliteration:  String,
    pub glosses:          Vec<String>,
    pub part_of_speech:   Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LexiconBookmark {
    pub id:              String,
    pub strongs_number:  String,
    pub original_word:   String,
    pub transliteration: Option<String>,
    pub language:        String,
    pub passage_ref:     Option<String>,
    pub note:            Option<String>,
    pub saved_at:        String,
}

#[derive(Debug, Deserialize)]
pub struct SaveBookmarkInput {
    pub strongs_number:  String,
    pub original_word:   String,
    pub transliteration: Option<String>,
    pub language:        String,
    pub passage_ref:     Option<String>,
    pub note:            Option<String>,
}

fn parse_glosses(json: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(json).unwrap_or_default()
}

#[tauri::command]
pub fn get_word(state: State<AppState>, strongs_number: String) -> Result<LexiconWord> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let (id, sn, lang, orig, translit, pron, pos, glosses_json, def, count): (
        String, String, String, String, String,
        Option<String>, Option<String>, String, Option<String>, Option<i64>,
    ) = conn.query_row(
        "SELECT id, strongs_number, language, original_word, transliteration,
                pronunciation, part_of_speech, glosses, definition, nt_ot_count
         FROM lexicon_words WHERE strongs_number = ?1",
        rusqlite::params![strongs_number.to_uppercase()],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?,
                r.get(5)?, r.get(6)?, r.get(7)?, r.get(8)?, r.get(9)?)),
    ).map_err(|_| AppError::NotFound(format!("Word {} not found", strongs_number)))?;

    let mut ostmt = conn.prepare(
        "SELECT o.id, o.word_id, o.book, o.chapter, o.verse, o.kjv_rendering, o.parsing
         FROM lexicon_occurrences o
         WHERE o.word_id = ?1
         ORDER BY o.book, o.chapter, o.verse"
    )?;

    let occurrences = ostmt.query_map(rusqlite::params![id], |r| {
        Ok(LexiconOccurrence {
            id:            r.get(0)?,
            word_id:       r.get(1)?,
            book:          r.get(2)?,
            chapter:       r.get(3)?,
            verse:         r.get(4)?,
            kjv_rendering: r.get(5)?,
            parsing:       r.get(6)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(LexiconWord {
        id, strongs_number: sn, language: lang, original_word: orig,
        transliteration: translit, pronunciation: pron, part_of_speech: pos,
        glosses: parse_glosses(&glosses_json), definition: def,
        nt_ot_count: count, occurrences,
    })
}

#[tauri::command]
pub fn search_words(
    state:    State<AppState>,
    query:    String,
    language: Option<String>,
) -> Result<Vec<LexiconWord>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    if query.trim().len() < 2 {
        return Err(AppError::InvalidInput("Query must be at least 2 characters".into()));
    }

    let like = format!("%{}%", query.to_lowercase());
    let mut sql = "SELECT id, strongs_number, language, original_word, transliteration,
                          pronunciation, part_of_speech, glosses, definition, nt_ot_count
                   FROM lexicon_words
                   WHERE (lower(transliteration) LIKE ?1 OR lower(original_word) LIKE ?1)".to_string();

    if let Some(ref lang) = language {
        sql.push_str(&format!(" AND language = '{}'", lang));
    }
    sql.push_str(" LIMIT 20");

    let mut stmt = conn.prepare(&sql)?;
    let words = stmt.query_map(rusqlite::params![like], |r| {
        let glosses_json: String = r.get(7)?;
        Ok(LexiconWord {
            id:              r.get(0)?,
            strongs_number:  r.get(1)?,
            language:        r.get(2)?,
            original_word:   r.get(3)?,
            transliteration: r.get(4)?,
            pronunciation:   r.get(5)?,
            part_of_speech:  r.get(6)?,
            glosses:         parse_glosses(&glosses_json),
            definition:      r.get(8)?,
            nt_ot_count:     r.get(9)?,
            occurrences:     vec![],
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(words)
}

#[tauri::command]
pub fn get_verse_interlinear(
    state:       State<AppState>,
    book:        String,
    chapter:     i64,
    verse:       i64,
    translation: Option<String>,
) -> Result<Vec<InterlinearWord>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT o.kjv_rendering, o.parsing,
                w.strongs_number, w.language, w.original_word,
                w.transliteration, w.glosses, w.part_of_speech
         FROM lexicon_occurrences o
         JOIN lexicon_words w ON w.id = o.word_id
         WHERE o.book = ?1 AND o.chapter = ?2 AND o.verse = ?3"
    )?;

    let words = stmt.query_map(rusqlite::params![book, chapter, verse], |r| {
        let glosses_json: String = r.get(6)?;
        Ok(InterlinearWord {
            kjv_rendering:   r.get(0)?,
            parsing:         r.get(1)?,
            strongs_number:  r.get(2)?,
            language:        r.get(3)?,
            original_word:   r.get(4)?,
            transliteration: r.get(5)?,
            glosses:         parse_glosses(&glosses_json),
            part_of_speech:  r.get(7)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(words)
}

#[tauri::command]
pub fn get_passage_interlinear(
    state:       State<AppState>,
    book:        String,
    chapter:     i64,
    translation: Option<String>,
) -> Result<std::collections::HashMap<i64, Vec<InterlinearWord>>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT o.verse, o.kjv_rendering, o.parsing,
                w.strongs_number, w.language, w.original_word,
                w.transliteration, w.glosses, w.part_of_speech
         FROM lexicon_occurrences o
         JOIN lexicon_words w ON w.id = o.word_id
         WHERE o.book = ?1 AND o.chapter = ?2
         ORDER BY o.verse"
    )?;

    let mut by_verse: std::collections::HashMap<i64, Vec<InterlinearWord>> = std::collections::HashMap::new();

    stmt.query_map(rusqlite::params![book, chapter], |r| {
        let glosses_json: String = r.get(7)?;
        Ok((r.get::<_, i64>(0)?, InterlinearWord {
            kjv_rendering:   r.get(1)?,
            parsing:         r.get(2)?,
            strongs_number:  r.get(3)?,
            language:        r.get(4)?,
            original_word:   r.get(5)?,
            transliteration: r.get(6)?,
            glosses:         parse_glosses(&glosses_json),
            part_of_speech:  r.get(8)?,
        }))
    })?.filter_map(|r| r.ok()).for_each(|(verse, word)| {
        by_verse.entry(verse).or_default().push(word);
    });

    Ok(by_verse)
}

#[tauri::command]
pub fn get_bookmarks(state: State<AppState>) -> Result<Vec<LexiconBookmark>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, strongs_number, original_word, transliteration,
                language, passage_ref, note, saved_at
         FROM lexicon_bookmarks ORDER BY saved_at DESC"
    )?;

    let bookmarks = stmt.query_map([], |r| {
        Ok(LexiconBookmark {
            id:              r.get(0)?,
            strongs_number:  r.get(1)?,
            original_word:   r.get(2)?,
            transliteration: r.get(3)?,
            language:        r.get(4)?,
            passage_ref:     r.get(5)?,
            note:            r.get(6)?,
            saved_at:        r.get(7)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(bookmarks)
}

#[tauri::command]
pub fn save_bookmark(
    state: State<AppState>,
    input: SaveBookmarkInput,
) -> Result<LexiconBookmark> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let id  = new_id();
    let now = crate::db::now();

    conn.execute(
        "INSERT INTO lexicon_bookmarks
         (id, strongs_number, original_word, transliteration, language, passage_ref, note, saved_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(strongs_number) DO UPDATE SET
             note        = excluded.note,
             passage_ref = excluded.passage_ref,
             saved_at    = excluded.saved_at",
        rusqlite::params![
            id, input.strongs_number, input.original_word, input.transliteration,
            input.language, input.passage_ref, input.note, now,
        ],
    )?;

    conn.query_row(
        "SELECT id, strongs_number, original_word, transliteration,
                language, passage_ref, note, saved_at
         FROM lexicon_bookmarks WHERE strongs_number = ?1",
        rusqlite::params![input.strongs_number],
        |r| Ok(LexiconBookmark {
            id:              r.get(0)?,
            strongs_number:  r.get(1)?,
            original_word:   r.get(2)?,
            transliteration: r.get(3)?,
            language:        r.get(4)?,
            passage_ref:     r.get(5)?,
            note:            r.get(6)?,
            saved_at:        r.get(7)?,
        }),
    ).map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn delete_bookmark(state: State<AppState>, strongs_number: String) -> Result<()> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;
    let rows = conn.execute(
        "DELETE FROM lexicon_bookmarks WHERE strongs_number = ?1",
        rusqlite::params![strongs_number],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound("Bookmark not found".into()));
    }
    Ok(())
}
