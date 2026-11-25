mod server;
mod settings;

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use settings::{AppState, ServerStatus, Settings};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

#[tauri::command]
fn get_settings(state: State<'_, Arc<AppState>>) -> Settings {
    state.current_settings()
}

#[tauri::command]
async fn save_settings(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    settings: Settings,
) -> Result<ServerStatus, String> {
    let previous = state.current_settings();
    state.replace_settings(settings)?;
    let next = state.current_settings();

    if previous.port != next.port || previous.bind_address != next.bind_address {
        let was_running = state.running.load(Ordering::SeqCst);
        server::stop(state.inner());
        if was_running {
            tokio::time::sleep(std::time::Duration::from_millis(180)).await;
            server::start(state.inner().clone()).await?;
        }
    }

    let _ = app.emit("bantrol://settings-changed", state.status());
    Ok(state.status())
}

#[tauri::command]
fn get_status(state: State<'_, Arc<AppState>>) -> ServerStatus {
    state.status()
}

#[tauri::command]
async fn start_server(state: State<'_, Arc<AppState>>) -> Result<ServerStatus, String> {
    server::start(state.inner().clone()).await?;
    Ok(state.status())
}

#[tauri::command]
fn stop_server(state: State<'_, Arc<AppState>>) -> ServerStatus {
    server::stop(state.inner());
    state.status()
}

#[tauri::command]
fn regenerate_pairing_code(state: State<'_, Arc<AppState>>) -> String {
    state.regenerate_pairing_code()
}

#[tauri::command]
fn show_window(app: AppHandle) {
    reveal_main(&app);
}

#[tauri::command]
fn hide_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn reveal_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Pokaż Bantrol", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Włącz / zatrzymaj serwer", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Zakończ Bantrol", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &quit])?;

    let mut builder = TrayIconBuilder::with_id("bantrol-tray")
        .menu(&menu)
        .tooltip("Bantrol — zdalne sterowanie komputerem")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => reveal_main(app),
            "toggle" => {
                let state = app.state::<Arc<AppState>>().inner().clone();
                tauri::async_runtime::spawn(async move {
                    if state.running.load(Ordering::SeqCst) {
                        server::stop(&state);
                    } else {
                        let _ = server::start(state.clone()).await;
                    }
                });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                reveal_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            let config_path = app
                .path()
                .app_config_dir()
                .map(|directory| directory.join("settings.json"))
                .unwrap_or_else(|_| PathBuf::from("bantrol-settings.json"));
            let settings = Settings::load(&config_path);
            let state = Arc::new(AppState::new(settings, config_path));
            app.manage(state.clone());

            tauri::async_runtime::spawn(async move {
                if let Err(error) = server::start(state.clone()).await {
                    if let Ok(mut slot) = state.last_error.write() {
                        *slot = Some(error);
                    }
                }
            });

            build_tray(app)?;

            if std::env::args().any(|argument| argument == "--hidden") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<Arc<AppState>>();
                if state.current_settings().run_in_background {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_status,
            start_server,
            stop_server,
            regenerate_pairing_code,
            show_window,
            hide_window,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("nie udało się uruchomić aplikacji Bantrol");
}
