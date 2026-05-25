// Workman — commands/import.rs
// src-tauri/src/commands/import.rs

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::{new_id, now};
use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::services::parser;

#[derive(Debug, Serialize)]
pub struct ImportJob {
    pub id:              String,
    pub status:          String,
    pub total_files:     i64,
    pub completed_files: i64,
    pub started_at:      String,
    pub completed_at:    Option<String>,
    pub items:           Vec<ImportItem>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ImportItem {
    pub id:                String,
    pub job_id:            String,
    pub sermon_id:         Option<String>,
    pub original_filename: String,
    pub file_format:       String,
    pub extracted_text:    Option<String>,
    pub review_status:     String,
    pub imported_at:       String,
}

#[derive(Debug, Deserialize)]
pub struct ApproveItemInput {
    pub title:         String,
    pub passage_ref:   String,
    pub book:          Option<String>,
    pub chapter_start: Option<i64>,
    pub delivery_date: Option<String>,
    pub series_id:     Option<String>,
}

#[tauri::command]
pub async fn import_files(
    state:      State<'_, AppState>,
    file_paths: Vec<String>,
) -> Result<ImportJob> {
    let job_id = new_id();
    let ts     = now();

    {
        let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;
        conn.execute(
            "INSERT INTO import_jobs (id, status, total_files, completed_files, started_at)
             VALUES (?1, 'PROCESSING', ?2, 0, ?3)",
            rusqlite::params![job_id, file_paths.len() as i64, ts],
        )?;
    }

    for path in &file_paths {
        let ext = std::path::Path::new(path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("txt")
            .to_lowercase();

        let filename = std::path::Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(path)
            .to_string();

        let extracted = match parser::parse_file(path, &ext) {
            Ok(result) => Some(result.text),
            Err(e)     => { eprintln!("Failed to parse {}: {}", path, e); None }
        };

        let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;
        conn.execute(
            "INSERT INTO import_items
             (id, job_id, original_filename, file_format, extracted_text, review_status, imported_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'PENDING', ?6)",
            rusqlite::params![new_id(), job_id, filename, ext, extracted, now()],
        )?;
    }

    {
        let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;
        conn.execute(
            "UPDATE import_jobs SET status = 'PENDING' WHERE id = ?1",
            rusqlite::params![job_id],
        )?;
    }

    get_job_inner(&state, &job_id)
}

#[tauri::command]
pub fn get_import_jobs(state: State<AppState>) -> Result<Vec<ImportJob>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, status, total_files, completed_files, started_at, completed_at
         FROM import_jobs ORDER BY started_at DESC"
    )?;

    let jobs = stmt.query_map([], |r| {
        Ok(ImportJob {
            id:              r.get(0)?,
            status:          r.get(1)?,
            total_files:     r.get(2)?,
            completed_files: r.get(3)?,
            started_at:      r.get(4)?,
            completed_at:    r.get(5)?,
            items:           vec![],
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(jobs)
}

#[tauri::command]
pub fn get_import_job(state: State<AppState>, job_id: String) -> Result<ImportJob> {
    get_job_inner(&state, &job_id)
}

fn get_job_inner(state: &State<AppState>, job_id: &str) -> Result<ImportJob> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut job = conn.query_row(
        "SELECT id, status, total_files, completed_files, started_at, completed_at
         FROM import_jobs WHERE id = ?1",
        rusqlite::params![job_id],
        |r| Ok(ImportJob {
            id:              r.get(0)?,
            status:          r.get(1)?,
            total_files:     r.get(2)?,
            completed_files: r.get(3)?,
            started_at:      r.get(4)?,
            completed_at:    r.get(5)?,
            items:           vec![],
        }),
    ).map_err(|_| AppError::NotFound(format!("Import job {} not found", job_id)))?;

    let mut istmt = conn.prepare(
        "SELECT id, job_id, sermon_id, original_filename, file_format,
                extracted_text, review_status, imported_at
         FROM import_items WHERE job_id = ?1 ORDER BY imported_at"
    )?;

    job.items = istmt.query_map(rusqlite::params![job_id], |r| {
        Ok(ImportItem {
            id:                r.get(0)?,
            job_id:            r.get(1)?,
            sermon_id:         r.get(2)?,
            original_filename: r.get(3)?,
            file_format:       r.get(4)?,
            extracted_text:    r.get(5)?,
            review_status:     r.get(6)?,
            imported_at:       r.get(7)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(job)
}

#[tauri::command]
pub fn approve_import_item(
    state:   State<AppState>,
    job_id:  String,
    item_id: String,
    input:   ApproveItemInput,
) -> Result<()> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let (extracted_text, status): (Option<String>, String) = conn.query_row(
        "SELECT extracted_text, review_status FROM import_items WHERE id = ?1 AND job_id = ?2",
        rusqlite::params![item_id, job_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    ).map_err(|_| AppError::NotFound("Import item not found".into()))?;

    if status != "PENDING" {
        return Err(AppError::InvalidInput("Item has already been reviewed".into()));
    }

    let sermon_id  = new_id();
    let ts         = now();
    let word_count = extracted_text.as_deref()
        .map(|t| t.split_whitespace().count() as i64)
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO sermons
         (id, series_id, title, passage_ref, book, chapter_start,
          mode, manuscript, word_count, status, delivery_date, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,'MANUSCRIPT',?7,?8,'IMPORTED',?9,?10,?11)",
        rusqlite::params![
            sermon_id, input.series_id, input.title, input.passage_ref,
            input.book, input.chapter_start, extracted_text,
            word_count, input.delivery_date, ts, ts,
        ],
    )?;

    conn.execute(
        "UPDATE import_items SET review_status = 'APPROVED', sermon_id = ?1 WHERE id = ?2",
        rusqlite::params![sermon_id, item_id],
    )?;

    update_job_progress(&conn, &job_id)
}

#[tauri::command]
pub fn skip_import_item(
    state:   State<AppState>,
    job_id:  String,
    item_id: String,
) -> Result<()> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    conn.execute(
        "UPDATE import_items SET review_status = 'SKIPPED' WHERE id = ?1 AND job_id = ?2",
        rusqlite::params![item_id, job_id],
    )?;

    update_job_progress(&conn, &job_id)
}

fn update_job_progress(conn: &rusqlite::Connection, job_id: &str) -> Result<()> {
    let (total, completed): (i64, i64) = conn.query_row(
        "SELECT COUNT(*),
                SUM(CASE WHEN review_status IN ('APPROVED','SKIPPED') THEN 1 ELSE 0 END)
         FROM import_items WHERE job_id = ?1",
        rusqlite::params![job_id],
        |r| Ok((r.get(0)?, r.get::<_, Option<i64>>(1)?.unwrap_or(0))),
    )?;

    let all_done = completed == total;
    conn.execute(
        "UPDATE import_jobs SET
            completed_files = ?1,
            status          = ?2,
            completed_at    = CASE WHEN ?3 THEN datetime('now') ELSE NULL END
         WHERE id = ?4",
        rusqlite::params![
            completed,
            if all_done { "COMPLETED" } else { "PENDING" },
            all_done,
            job_id,
        ],
    )?;

    Ok(())
}
