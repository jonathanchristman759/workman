// Workman — commands/illustrations.rs
// src-tauri/src/commands/illustrations.rs

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::{new_id, now};
use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct Illustration {
    pub id:           String,
    pub title:        String,
    pub body:         String,
    pub source:       Option<String>,
    pub language:     String,
    pub is_custom:    bool,
    pub is_favorited: bool,
    pub created_at:   String,
    pub tags:         Vec<IllustrationTag>,
}

#[derive(Debug, Serialize, Clone)]
pub struct IllustrationTag {
    pub tag:      String,
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TagEntry {
    pub tag:      String,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIllustrationInput {
    pub title:    String,
    pub body:     String,
    pub source:   Option<String>,
    pub language: Option<String>,
    pub tags:     Option<Vec<TagInput>>,
}

#[derive(Debug, Deserialize)]
pub struct TagInput {
    pub tag:      String,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIllustrationInput {
    pub title:  Option<String>,
    pub body:   Option<String>,
    pub source: Option<String>,
}

fn fetch_tags(conn: &rusqlite::Connection, ill_id: &str) -> Vec<IllustrationTag> {
    let mut stmt = match conn.prepare(
        "SELECT tag, category FROM illustration_tags WHERE illustration_id = ?1"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    stmt.query_map(rusqlite::params![ill_id], |r| {
        Ok(IllustrationTag { tag: r.get(0)?, category: r.get(1)? })
    }).into_iter()
      .flatten()
      .filter_map(|r| r.ok())
      .collect()
}

fn row_to_ill(row: &rusqlite::Row) -> rusqlite::Result<Illustration> {
    Ok(Illustration {
        id:           row.get(0)?,
        title:        row.get(1)?,
        body:         row.get(2)?,
        source:       row.get(3)?,
        language:     row.get(4)?,
        is_custom:    row.get::<_, i64>(5)? == 1,
        is_favorited: row.get::<_, i64>(6)? == 1,
        created_at:   row.get(7)?,
        tags:         vec![],
    })
}

#[tauri::command]
pub fn get_illustrations(
    state:          State<AppState>,
    language:       Option<String>,
    search:         Option<String>,
    tag:            Option<String>,
    source:         Option<String>,
    favorites_only: Option<bool>,
) -> Result<Vec<Illustration>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let lang = language.unwrap_or_else(|| "EN".to_string());
    let mut sql = "SELECT id, title, body, source, language, is_custom, is_favorited, created_at
                   FROM illustrations WHERE language = ?1".to_string();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(lang)];

    if favorites_only.unwrap_or(false) {
        sql.push_str(" AND is_favorited = 1");
    }
    if let Some(ref s) = search {
        sql.push_str(&format!(" AND (title LIKE ?{p} OR body LIKE ?{p})", p = params.len() + 1));
        params.push(Box::new(format!("%{}%", s)));
    }
    if let Some(ref src) = source {
        match src.as_str() {
            "mine"    => sql.push_str(" AND is_custom = 1"),
            "curated" => sql.push_str(" AND is_custom = 0"),
            _         => {}
        }
    }
    sql.push_str(" ORDER BY is_favorited DESC, created_at DESC");

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let mut illustrations: Vec<Illustration> = stmt
        .query_map(param_refs.as_slice(), row_to_ill)?
        .filter_map(|r| r.ok())
        .collect();

    for ill in &mut illustrations {
        ill.tags = fetch_tags(&conn, &ill.id);
    }

    if let Some(ref t) = tag {
        illustrations.retain(|ill| ill.tags.iter().any(|tg| tg.tag == *t));
    }

    Ok(illustrations)
}

#[tauri::command]
pub fn get_illustration(state: State<AppState>, id: String) -> Result<Illustration> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut ill = conn.query_row(
        "SELECT id, title, body, source, language, is_custom, is_favorited, created_at
         FROM illustrations WHERE id = ?1",
        rusqlite::params![id],
        row_to_ill,
    ).map_err(|_| AppError::NotFound(format!("Illustration {} not found", id)))?;

    ill.tags = fetch_tags(&conn, &ill.id);
    Ok(ill)
}

#[tauri::command]
pub fn create_illustration(
    state: State<AppState>,
    input: CreateIllustrationInput,
) -> Result<Illustration> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let id   = new_id();
    let ts   = now();
    let lang = input.language.unwrap_or_else(|| "EN".to_string());

    conn.execute(
        "INSERT INTO illustrations
         (id, title, body, source, language, is_custom, is_favorited, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,1,0,?6,?7)",
        rusqlite::params![id, input.title, input.body, input.source, lang, ts, ts],
    )?;

    if let Some(tags) = input.tags {
        for tag in tags {
            conn.execute(
                "INSERT INTO illustration_tags (id, illustration_id, tag, category)
                 VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![new_id(), id, tag.tag, tag.category],
            )?;
        }
    }

    let mut ill = conn.query_row(
        "SELECT id, title, body, source, language, is_custom, is_favorited, created_at
         FROM illustrations WHERE id = ?1",
        rusqlite::params![id],
        row_to_ill,
    )?;
    ill.tags = fetch_tags(&conn, &ill.id);
    Ok(ill)
}

#[tauri::command]
pub fn update_illustration(
    state: State<AppState>,
    id:    String,
    input: UpdateIllustrationInput,
) -> Result<Illustration> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let is_custom: i64 = conn.query_row(
        "SELECT is_custom FROM illustrations WHERE id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).map_err(|_| AppError::NotFound("Illustration not found".into()))?;

    if is_custom == 0 {
        return Err(AppError::InvalidInput("Cannot edit curated illustrations".into()));
    }

    let mut sets = vec!["updated_at = datetime('now')".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref t) = input.title {
        params.push(Box::new(t.clone()));
        sets.push(format!("title = ?{}", params.len()));
    }
    if let Some(ref b) = input.body {
        params.push(Box::new(b.clone()));
        sets.push(format!("body = ?{}", params.len()));
    }
    if let Some(ref s) = input.source {
        params.push(Box::new(s.clone()));
        sets.push(format!("source = ?{}", params.len()));
    }

    params.push(Box::new(id.clone()));
    let idx = params.len();
    let sql = format!("UPDATE illustrations SET {} WHERE id = ?{}", sets.join(", "), idx);
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())?;

    let mut ill = conn.query_row(
        "SELECT id, title, body, source, language, is_custom, is_favorited, created_at
         FROM illustrations WHERE id = ?1",
        rusqlite::params![id],
        row_to_ill,
    )?;
    ill.tags = fetch_tags(&conn, &ill.id);
    Ok(ill)
}

#[tauri::command]
pub fn delete_illustration(state: State<AppState>, id: String) -> Result<()> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let is_custom: i64 = conn.query_row(
        "SELECT is_custom FROM illustrations WHERE id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).map_err(|_| AppError::NotFound("Illustration not found".into()))?;

    if is_custom == 0 {
        return Err(AppError::InvalidInput("Cannot delete curated illustrations".into()));
    }

    conn.execute("DELETE FROM illustrations WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

#[tauri::command]
pub fn toggle_favorite(state: State<AppState>, id: String) -> Result<bool> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let current: i64 = conn.query_row(
        "SELECT is_favorited FROM illustrations WHERE id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).map_err(|_| AppError::NotFound("Illustration not found".into()))?;

    let new_val = if current == 1 { 0i64 } else { 1i64 };
    conn.execute(
        "UPDATE illustrations SET is_favorited = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![new_val, id],
    )?;

    Ok(new_val == 1)
}

#[tauri::command]
pub fn get_tags(state: State<AppState>) -> Result<Vec<TagEntry>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT DISTINCT tag, category FROM illustration_tags ORDER BY tag"
    )?;

    let tags = stmt.query_map([], |r| {
        Ok(TagEntry { tag: r.get(0)?, category: r.get(1)? })
    })?.filter_map(|r| r.ok()).collect();

    Ok(tags)
}

#[tauri::command]
pub fn get_suggestions(
    _state: State<AppState>,
    book:   Option<String>,
) -> Result<Vec<String>> {
    let book_themes: std::collections::HashMap<&str, Vec<&str>> = [
        ("John",        vec!["redemption","light","belief","shepherd"]),
        ("Romans",      vec!["grace","justification","faith","sin"]),
        ("Psalms",      vec!["worship","trust","lament","shepherd"]),
        ("Luke",        vec!["lost and found","grace","forgiveness"]),
        ("Matthew",     vec!["kingdom","faith","prayer","salt and light"]),
        ("Genesis",     vec!["creation","covenant","faith","sacrifice"]),
        ("Hebrews",     vec!["faith","perseverance","sacrifice"]),
        ("Ephesians",   vec!["grace","unity","identity in christ"]),
        ("Philippians", vec!["joy","contentment","humility"]),
        ("James",       vec!["faith","works","wisdom","prayer"]),
    ].iter().cloned().collect();

    let b = book.as_deref().unwrap_or("");
    let tags = book_themes.get(b)
        .map(|v| v.iter().map(|s| s.to_string()).collect())
        .unwrap_or_else(|| vec!["faith".to_string(), "grace".to_string(), "redemption".to_string()]);

    Ok(tags)
}
