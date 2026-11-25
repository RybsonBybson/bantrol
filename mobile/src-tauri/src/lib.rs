#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_barcode_scanner::init());

    builder
        .run(tauri::generate_context!())
        .expect("nie udało się uruchomić aplikacji Bantrol");
}
