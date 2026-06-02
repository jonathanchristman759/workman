// Workman — commands/settings.rs
// src-tauri/src/commands/settings.rs

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::error::{AppError, Result};
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub name:              String,
    pub church:            Option<String>,
    pub denomination:      Option<String>,
    pub language:          String,
    pub theme:             String,
    pub editor_font_size:  i64,
    pub logos_connected:   bool,
    pub show_editor_hints: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    pub name:               Option<String>,
    pub church:             Option<String>,
    pub denomination:       Option<String>,
    pub language:           Option<String>,
    pub theme:              Option<String>,
    pub editor_font_size:   Option<i64>,
    pub show_editor_hints:  Option<bool>,
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Settings> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    conn.query_row(
    "SELECT name, church, denomination, language, theme, editor_font_size, logos_connected, show_editor_hints
FROM settings WHERE id = 1",
    [],
    |r| {
        let show_hints: i64 = r.get(7)?;
        Ok(Settings {
            name:              r.get(0)?,
            church:            r.get(1)?,
            denomination:      r.get(2)?,
            language:          r.get(3)?,
            theme:             r.get(4)?,
            editor_font_size:  r.get(5)?,
            logos_connected:   r.get::<_, i64>(6)? == 1,
            show_editor_hints: show_hints == 1,
        })
    },
).map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn update_settings(
    state: State<AppState>,
    input: UpdateSettingsInput,
) -> Result<Settings> {
    let conn = state.db.lock().map_err(|_| AppError::Database("Lock error".into()))?;

    let mut sets = vec!["updated_at = datetime('now')".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    macro_rules! add {
        ($col:expr, $val:expr) => {
            if let Some(v) = $val {
                params.push(Box::new(v));
                sets.push(format!("{} = ?{}", $col, params.len()));
            }
        };
    }

    add!("name",             input.name.clone());
    add!("church",           input.church.clone());
    add!("denomination",     input.denomination.clone());
    add!("language",         input.language.clone());
    add!("theme",            input.theme.clone());
    add!("editor_font_size", input.editor_font_size);
    if let Some(v) = input.show_editor_hints {
    params.push(Box::new(if v { 1i64 } else { 0i64 }));
    sets.push(format!("show_editor_hints = ?{}", params.len()));
}

    if !sets.is_empty() {
        let sql = format!("UPDATE settings SET {} WHERE id = 1", sets.join(", "));
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let result = conn.execute(&sql, param_refs.as_slice())?;
    }

    conn.query_row(
        "SELECT name, church, denomination, language, theme, editor_font_size, logos_connected, show_editor_hints
 FROM settings WHERE id = 1",
        [],
        |r| Ok(Settings {
            name:             r.get(0)?,
            church:           r.get(1)?,
            denomination:     r.get(2)?,
            language:         r.get(3)?,
            theme:            r.get(4)?,
            editor_font_size: r.get(5)?,
            logos_connected:  r.get::<_, i64>(6)? == 1,
            show_editor_hints: r.get::<_, i64>(7)? == 1,
        }),
    ).map_err(|e| AppError::Database(e.to_string()))
}

#[tauri::command]
pub fn open_logos_link(
    strongs_number: String,
    passage_ref:    Option<String>,
) -> Result<()> {
    let url = if let Some(ref r) = passage_ref {
        format!("logos4://passage/{}", r.replace(' ', "_"))
    } else {
        format!("logos4://strongs/{}", strongs_number)
    };

    tauri_plugin_opener::open_url(&url, None::<&str>)
        .map_err(|e| AppError::FileError(e.to_string()))?;

    Ok(())
}
