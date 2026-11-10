#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Holdall could not start its window. Reinstall the app, then report the issue if it persists.");
}
