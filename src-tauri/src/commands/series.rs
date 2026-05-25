// Workman — commands/series.rs
// src-tauri/src/commands/series.rs

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::{new_id, now};
use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct Series {
    pub id:          String,
    pub title:       String,
    pub description: Option<String>,
    pub created_at:  String,
    pub updated_at:  String,
    pub sermon_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateSeriesInput {
    pub title:       String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSeriesInput {
    pub title:       Option<String>,
    pub description: Option<String>,
}

fn row_to_series(row: &rusqlite::Row) -> rusqlite::Result<Series> {
    Ok(Series {
        id:           row.get(0)?,
        title:        row.get(1)?,
        description:  row.get(2)?,
        created_at:   row.get(3)?,
        updated_at:   row.get(4)?,
        sermon_count: row.get(5).unwrap_or(0),
    })
}

#[tauri::command]
pub fn get_series(state: State<AppState>) -> Result<Vec<Series>> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut stmt = conn.prepare(
        "SELECT s.id, s.title, s.description, s.created_at, s.updated_at,
                COUNT(sr.id) as sermon_count
         FROM series s
         LEFT JOIN sermons sr ON sr.series_id = s.id
         GROUP BY s.id
         ORDER BY s.created_at DESC"
    )?;

    let series = stmt.query_map([], row_to_series)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(series)
}

#[tauri::command]
pub fn get_series_by_id(state: State<AppState>, id: String) -> Result<Series> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    conn.query_row(
        "SELECT s.id, s.title, s.description, s.created_at, s.updated_at,
                COUNT(sr.id) as sermon_count
         FROM series s
         LEFT JOIN sermons sr ON sr.series_id = s.id
         WHERE s.id = ?1
         GROUP BY s.id",
        rusqlite::params![id],
        row_to_series,
    ).map_err(|_| AppError::NotFound(format!("Series {} not found", id)))
}

#[tauri::command]
pub fn create_series(
    state: State<AppState>,
    input: CreateSeriesInput,
) -> Result<Series> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    if input.title.trim().is_empty() {
        return Err(AppError::InvalidInput("Title is required".into()));
    }

    let id = new_id();
    let ts = now();

    conn.execute(
        "INSERT INTO series (id, title, description, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, input.title, input.description, ts, ts],
    )?;

    conn.query_row(
        "SELECT s.id, s.title, s.description, s.created_at, s.updated_at,
                COUNT(sr.id) as sermon_count
         FROM series s
         LEFT JOIN sermons sr ON sr.series_id = s.id
         WHERE s.id = ?1
         GROUP BY s.id",
        rusqlite::params![id],
        row_to_series,
    ).map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn update_series(
    state: State<AppState>,
    id:    String,
    input: UpdateSeriesInput,
) -> Result<Series> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM series WHERE id = ?1)",
        rusqlite::params![id],
        |r| r.get(0),
    ).unwrap_or(false);

    if !exists {
        return Err(AppError::NotFound(format!("Series {} not found", id)));
    }

    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now())];

    if let Some(ref t) = input.title {
        params.push(Box::new(t.clone()));
        sets.push(format!("title = ?{}", params.len()));
    }
    if let Some(ref d) = input.description {
        params.push(Box::new(d.clone()));
        sets.push(format!("description = ?{}", params.len()));
    }

    params.push(Box::new(id.clone()));
    let idx = params.len();
    let sql = format!("UPDATE series SET {} WHERE id = ?{}", sets.join(", "), idx);
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())?;

    conn.query_row(
        "SELECT s.id, s.title, s.description, s.created_at, s.updated_at,
                COUNT(sr.id) as sermon_count
         FROM series s
         LEFT JOIN sermons sr ON sr.series_id = s.id
         WHERE s.id = ?1
         GROUP BY s.id",
        rusqlite::params![id],
        row_to_series,
    ).map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn delete_series(state: State<AppState>, id: String) -> Result<()> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;
    let rows = conn.execute(
        "DELETE FROM series WHERE id = ?1",
        rusqlite::params![id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Series {} not found", id)));
    }
    Ok(())
}
