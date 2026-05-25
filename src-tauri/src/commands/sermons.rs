// Workman — commands/sermons.rs
// src-tauri/src/commands/sermons.rs
// All Tauri commands for sermon CRUD, versioning, delivery, and PDF export.

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::{new_id, now};
use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::services::pdf;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Sermon {
    pub id:            String,
    pub series_id:     Option<String>,
    pub title:         String,
    pub passage_ref:   String,
    pub book:          Option<String>,
    pub chapter_start: Option<i64>,
    pub chapter_end:   Option<i64>,
    pub mode:          String,
    pub outline_json:  Option<String>,
    pub manuscript:    Option<String>,
    pub notes:         Option<String>,
    pub word_count:    i64,
    pub status:        String,
    pub delivery_date: Option<String>,
    pub created_at:    String,
    pub updated_at:    String,
    // Joined fields
    pub series_title:  Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SermonVersion {
    pub id:            String,
    pub sermon_id:     String,
    pub snapshot_json: String,
    pub saved_at:      String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSermonInput {
    pub title:         String,
    pub passage_ref:   String,
    pub book:          Option<String>,
    pub chapter_start: Option<i64>,
    pub chapter_end:   Option<i64>,
    pub mode:          Option<String>,
    pub series_id:     Option<String>,
    pub delivery_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSermonInput {
    pub title:         Option<String>,
    pub passage_ref:   Option<String>,
    pub book:          Option<String>,
    pub chapter_start: Option<i64>,
    pub chapter_end:   Option<i64>,
    pub mode:          Option<String>,
    pub outline_json:  Option<String>,
    pub manuscript:    Option<String>,
    pub notes:         Option<String>,
    pub word_count:    Option<i64>,
    pub status:        Option<String>,
    pub series_id:     Option<String>,
    pub delivery_date: Option<String>,
    pub autosave:      Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CoverageEntry {
    pub book:     String,
    pub count:    i64,
    pub chapters: Vec<i64>,
}

#[derive(Debug, Serialize)]
pub struct RepeatWarning {
    pub message:      String,
    pub last_preached: Option<String>,
    pub last_title:   String,
}

#[derive(Debug, Serialize)]
pub struct CreateSermonResult {
    pub sermon:         Sermon,
    pub repeat_warning: Option<RepeatWarning>,
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

fn row_to_sermon(row: &rusqlite::Row) -> rusqlite::Result<Sermon> {
    Ok(Sermon {
        id:            row.get(0)?,
        series_id:     row.get(1)?,
        title:         row.get(2)?,
        passage_ref:   row.get(3)?,
        book:          row.get(4)?,
        chapter_start: row.get(5)?,
        chapter_end:   row.get(6)?,
        mode:          row.get(7)?,
        outline_json:  row.get(8)?,
        manuscript:    row.get(9)?,
        notes:         row.get(10)?,
        word_count:    row.get(11)?,
        status:        row.get(12)?,
        delivery_date: row.get(13)?,
        created_at:    row.get(14)?,
        updated_at:    row.get(15)?,
        series_title:  row.get(16)?,
    })
}

const SERMON_SELECT: &str = "
    SELECT s.id, s.series_id, s.title, s.passage_ref, s.book,
           s.chapter_start, s.chapter_end, s.mode,
           s.outline_json, s.manuscript, s.notes,
           s.word_count, s.status, s.delivery_date,
           s.created_at, s.updated_at,
           sr.title as series_title
    FROM sermons s
    LEFT JOIN series sr ON sr.id = s.series_id
";

fn save_version(conn: &rusqlite::Connection, sermon_id: &str) -> Result<()> {
    // Get current sermon state
    let snapshot: Option<String> = conn.query_row(
        "SELECT json_object(
            'title', title, 'passage_ref', passage_ref, 'mode', mode,
            'outline_json', outline_json, 'manuscript', manuscript,
            'notes', notes, 'word_count', word_count
         ) FROM sermons WHERE id = ?1",
        rusqlite::params![sermon_id],
        |r| r.get(0),
    ).ok();

    if let Some(snap) = snapshot {
        conn.execute(
            "INSERT INTO sermon_versions (id, sermon_id, snapshot_json, saved_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![new_id(), sermon_id, snap, now()],
        )?;

        // Keep only the last 50 versions
        conn.execute(
            "DELETE FROM sermon_versions
             WHERE sermon_id = ?1
             AND id NOT IN (
                 SELECT id FROM sermon_versions
                 WHERE sermon_id = ?1
                 ORDER BY saved_at DESC
                 LIMIT 50
             )",
            rusqlite::params![sermon_id],
        )?;
    }
    Ok(())
}

fn check_repeat(conn: &rusqlite::Connection, book: &str, exclude_id: Option<&str>) -> Option<RepeatWarning> {
    // Check if this book was preached in the last 2 years
    let two_years_ago = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(730))
        .map(|d| d.format("%Y-%m-%dT%H:%M:%SZ").to_string())
        .unwrap_or_default();

    let exclude = exclude_id.unwrap_or("__none__");

    let result: Option<(String, String, String)> = conn.query_row(
        "SELECT title, passage_ref, delivery_date
         FROM sermons
         WHERE book = ?1
         AND status = 'DELIVERED'
         AND delivery_date >= ?2
         AND id != ?3
         ORDER BY delivery_date DESC
         LIMIT 1",
        rusqlite::params![book, two_years_ago, exclude],
        |r| Ok((r.get(0)?, r.get(1)?, r.get::<_, Option<String>>(2)?.unwrap_or_default())),
    ).ok();

    result.map(|(title, passage, date)| RepeatWarning {
        message:       format!("You preached from {} recently.", book),
        last_preached: Some(date),
        last_title:    format!("{} ({})", title, passage),
    })
}

// ─────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────

#[tauri::command]
pub fn get_sermons(
    state:  State<AppState>,
    search: Option<String>,
    book:   Option<String>,
    status: Option<String>,
    year:   Option<i32>,
) -> Result<Vec<Sermon>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut sql = format!("{} WHERE 1=1", SERMON_SELECT);
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref s) = search {
        sql.push_str(" AND (s.title LIKE ?1 OR s.passage_ref LIKE ?1)");
        params.push(Box::new(format!("%{}%", s)));
    }
    if let Some(ref b) = book {
        sql.push_str(&format!(" AND s.book = ?{}", params.len() + 1));
        params.push(Box::new(b.clone()));
    }
    if let Some(ref st) = status {
        sql.push_str(&format!(" AND s.status = ?{}", params.len() + 1));
        params.push(Box::new(st.clone()));
    }
    if let Some(y) = year {
        sql.push_str(&format!(
            " AND s.delivery_date >= ?{p1} AND s.delivery_date < ?{p2}",
            p1 = params.len() + 1,
            p2 = params.len() + 2
        ));
        params.push(Box::new(format!("{}-01-01", y)));
        params.push(Box::new(format!("{}-01-01", y + 1)));
    }

    sql.push_str(" ORDER BY s.updated_at DESC");

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let sermons = stmt.query_map(param_refs.as_slice(), row_to_sermon)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(sermons)
}

#[tauri::command]
pub fn get_sermon(state: State<AppState>, id: String) -> Result<Sermon> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let sql = format!("{} WHERE s.id = ?1", SERMON_SELECT);
    conn.query_row(&sql, rusqlite::params![id], row_to_sermon)
        .map_err(|_| AppError::NotFound(format!("Sermon {} not found", id)))
}

#[tauri::command]
pub fn create_sermon(
    state: State<AppState>,
    input: CreateSermonInput,
) -> Result<CreateSermonResult> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    if input.title.trim().is_empty() {
        return Err(AppError::InvalidInput("Title is required".into()));
    }

    let id   = new_id();
    let ts   = now();
    let mode = input.mode.unwrap_or_else(|| "OUTLINE".to_string());

    conn.execute(
        "INSERT INTO sermons
         (id, series_id, title, passage_ref, book, chapter_start, chapter_end,
          mode, word_count, status, delivery_date, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0,'DRAFT',?9,?10,?11)",
        rusqlite::params![
            id, input.series_id, input.title, input.passage_ref,
            input.book, input.chapter_start, input.chapter_end,
            mode, input.delivery_date, ts, ts,
        ],
    )?;

    // Check for repeat passage
    let repeat_warning = input.book.as_deref()
        .and_then(|b| check_repeat(&conn, b, None));

    let sql = format!("{} WHERE s.id = ?1", SERMON_SELECT);
    let sermon = conn.query_row(&sql, rusqlite::params![id], row_to_sermon)?;

    Ok(CreateSermonResult { sermon, repeat_warning })
}

#[tauri::command]
pub fn update_sermon(
    state:  State<AppState>,
    id:     String,
    input:  UpdateSermonInput,
) -> Result<Sermon> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    // Verify sermon exists
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sermons WHERE id = ?1)",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound(format!("Sermon {} not found", id)));
    }

    // Save a version snapshot if this is an auto-save
    if input.autosave.unwrap_or(false) {
        save_version(&conn, &id)?;
    }

    // Build dynamic UPDATE — only update provided fields
    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now())];

    macro_rules! add_field {
        ($field:expr, $value:expr) => {
            if let Some(v) = $value {
                params.push(Box::new(v));
                sets.push(format!("{} = ?{}", $field, params.len()));
            }
        };
    }

    add_field!("title",         input.title.clone());
    add_field!("passage_ref",   input.passage_ref.clone());
    add_field!("book",          input.book.clone());
    add_field!("chapter_start", input.chapter_start);
    add_field!("chapter_end",   input.chapter_end);
    add_field!("mode",          input.mode.clone());
    add_field!("outline_json",  input.outline_json.clone());
    add_field!("manuscript",    input.manuscript.clone());
    add_field!("notes",         input.notes.clone());
    add_field!("word_count",    input.word_count);
    add_field!("status",        input.status.clone());
    add_field!("delivery_date", input.delivery_date.clone());

    // series_id can be set to null
    if input.series_id.is_some() {
        params.push(Box::new(input.series_id.clone()));
        sets.push(format!("series_id = ?{}", params.len()));
    }

    params.push(Box::new(id.clone()));
    let id_param_idx = params.len();

    let sql = format!("UPDATE sermons SET {} WHERE id = ?{}", sets.join(", "), id_param_idx);
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())?;

    let select_sql = format!("{} WHERE s.id = ?1", SERMON_SELECT);
    conn.query_row(&select_sql, rusqlite::params![id], row_to_sermon)
        .map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn delete_sermon(state: State<AppState>, id: String) -> Result<()> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;
    let rows = conn.execute("DELETE FROM sermons WHERE id = ?1", rusqlite::params![id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Sermon {} not found", id)));
    }
    Ok(())
}

#[tauri::command]
pub fn mark_delivered(state: State<AppState>, id: String) -> Result<Sermon> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    // Get current delivery date
    let delivery_date: Option<String> = conn.query_row(
        "SELECT delivery_date FROM sermons WHERE id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    ).map_err(|_| AppError::NotFound(format!("Sermon {} not found", id)))?;

    let date = delivery_date.unwrap_or_else(now);

    save_version(&conn, &id)?;

    conn.execute(
        "UPDATE sermons SET status = 'DELIVERED', delivery_date = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![date, now(), id],
    )?;

    let sql = format!("{} WHERE s.id = ?1", SERMON_SELECT);
    conn.query_row(&sql, rusqlite::params![id], row_to_sermon)
        .map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn get_versions(state: State<AppState>, sermon_id: String) -> Result<Vec<SermonVersion>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, sermon_id, snapshot_json, saved_at
         FROM sermon_versions
         WHERE sermon_id = ?1
         ORDER BY saved_at DESC
         LIMIT 50"
    )?;

    let versions = stmt.query_map(rusqlite::params![sermon_id], |r| {
        Ok(SermonVersion {
            id:            r.get(0)?,
            sermon_id:     r.get(1)?,
            snapshot_json: r.get(2)?,
            saved_at:      r.get(3)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(versions)
}

#[tauri::command]
pub fn restore_version(
    state:      State<AppState>,
    sermon_id:  String,
    version_id: String,
) -> Result<Sermon> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    // Save current state before restoring
    save_version(&conn, &sermon_id)?;

    // Get the version snapshot
    let snapshot_json: String = conn.query_row(
        "SELECT snapshot_json FROM sermon_versions WHERE id = ?1 AND sermon_id = ?2",
        rusqlite::params![version_id, sermon_id],
        |r| r.get(0),
    ).map_err(|_| AppError::NotFound("Version not found".into()))?;

    // Parse snapshot and restore
    let snap: serde_json::Value = serde_json::from_str(&snapshot_json)
        .map_err(|e| AppError::ParseError(e.to_string()))?;

    conn.execute(
        "UPDATE sermons SET
            title       = ?1,
            passage_ref = ?2,
            mode        = ?3,
            outline_json= ?4,
            manuscript  = ?5,
            notes       = ?6,
            word_count  = ?7,
            updated_at  = ?8
         WHERE id = ?9",
        rusqlite::params![
            snap["title"].as_str().unwrap_or(""),
            snap["passage_ref"].as_str().unwrap_or(""),
            snap["mode"].as_str().unwrap_or("OUTLINE"),
            snap["outline_json"].as_str(),
            snap["manuscript"].as_str(),
            snap["notes"].as_str(),
            snap["word_count"].as_i64().unwrap_or(0),
            now(),
            sermon_id,
        ],
    )?;

    let sql = format!("{} WHERE s.id = ?1", SERMON_SELECT);
    conn.query_row(&sql, rusqlite::params![sermon_id], row_to_sermon)
        .map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub async fn export_sermon_pdf(
    state:  State<'_, AppState>,
    id:     String,
    output_path: String,
) -> Result<String> {
    let sermon = {
        let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

        let sql = format!("{} WHERE s.id = ?1", SERMON_SELECT);
        conn.query_row(&sql, rusqlite::params![id], row_to_sermon)
            .map_err(|_| AppError::NotFound(format!("Sermon {} not found", id)))?
    };

    // Get settings for pastor name and church
    let (name, church) = {
        let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;
        conn.query_row(
            "SELECT name, church FROM settings WHERE id = 1",
            [],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, Option<String>>(1)?)),
        ).unwrap_or_else(|_| (String::new(), None))
    };

    pdf::export_sermon(&sermon, &name, church.as_deref(), &output_path)?;

    Ok(output_path)
}

#[tauri::command]
pub fn get_coverage(state: State<AppState>) -> Result<Vec<CoverageEntry>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT book, COUNT(*) as count
         FROM sermons
         WHERE status = 'DELIVERED' AND book IS NOT NULL
         GROUP BY book"
    )?;

    let mut entries: Vec<CoverageEntry> = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
    })?
    .filter_map(|r| r.ok())
    .map(|(book, count)| CoverageEntry { book, count, chapters: vec![] })
    .collect();

    // Fetch chapters per book
    for entry in &mut entries {
        let mut cstmt = conn.prepare(
            "SELECT DISTINCT chapter_start FROM sermons
             WHERE book = ?1 AND status = 'DELIVERED' AND chapter_start IS NOT NULL
             ORDER BY chapter_start"
        )?;
        entry.chapters = cstmt.query_map(rusqlite::params![entry.book], |r| r.get(0))?
            .filter_map(|r| r.ok())
            .collect();
    }

    Ok(entries)
}
