mod raw_input;

#[tauri::command]
fn log_error(message: String) {
    eprintln!("[webview] {}", message);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            log_error,
            raw_input::start_raw_input,
            raw_input::stop_raw_input,
            raw_input::take_raw_mouse_delta
        ])
        .setup(|app| {
            raw_input::setup(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
