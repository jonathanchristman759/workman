mod commands;
mod db;
mod error;
mod services;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
.plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let db_path = app_data_dir.join("workman.db");

            let conn = db::init(&db_path)
                .expect("Failed to initialise database");

            db::seed::seed_if_empty(&conn)
                .expect("Failed to seed initial data");

            app.manage(AppState::new(conn));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::sermons::get_sermons,
            commands::sermons::get_sermon,
            commands::sermons::create_sermon,
            commands::sermons::update_sermon,
            commands::sermons::delete_sermon,
            commands::sermons::mark_delivered,
            commands::sermons::get_versions,
            commands::sermons::restore_version,
            commands::sermons::export_sermon_pdf,
            commands::sermons::get_coverage,

            commands::series::get_series,
            commands::series::get_series_by_id,
            commands::series::create_series,
            commands::series::update_series,
            commands::series::delete_series,

            commands::lexicon::get_word,
            commands::lexicon::search_words,
            commands::lexicon::get_verse_interlinear,
            commands::lexicon::get_passage_interlinear,
            commands::lexicon::get_bookmarks,
            commands::lexicon::save_bookmark,
            commands::lexicon::delete_bookmark,

            commands::bible::get_verse,
            commands::bible::get_passage,
            commands::bible::search_verses,

            commands::illustrations::get_illustrations,
            commands::illustrations::get_illustration,
            commands::illustrations::create_illustration,
            commands::illustrations::update_illustration,
            commands::illustrations::delete_illustration,
            commands::illustrations::toggle_favorite,
            commands::illustrations::get_tags,
            commands::illustrations::get_suggestions,

            commands::import::import_files,
            commands::import::get_import_jobs,
            commands::import::get_import_job,
            commands::import::approve_import_item,
            commands::import::skip_import_item,

            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::open_logos_link,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Workman");
}