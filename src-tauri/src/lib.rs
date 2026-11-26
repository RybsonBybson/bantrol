#[cfg(desktop)]
mod power;
#[cfg(desktop)]
mod server;
#[cfg(desktop)]
mod settings;

#[cfg(desktop)]
use std::path::PathBuf;
#[cfg(desktop)]
use std::sync::atomic::Ordering;
#[cfg(desktop)]
use std::sync::Arc;

#[cfg(desktop)]
use settings::{AppState, ServerStatus, Settings};
#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
#[cfg(desktop)]
use tauri_plugin_autostart::MacosLauncher;

#[cfg(desktop)]
const CONNECTION_ERROR: &str = "Nie udało się włączyć połączenia. Spróbuj ponownie.";

#[cfg(desktop)]
#[tauri::command]
fn get_settings(state: State<'_, Arc<AppState>>) -> Settings {
    state.current_settings()
}

#[cfg(desktop)]
#[tauri::command]
async fn save_settings(
    state: State<'_, Arc<AppState>>,
    settings: Settings,
) -> Result<ServerStatus, String> {
    let previous = state.current_settings();
    state
        .replace_settings(settings)
        .map_err(|_| "Nie udało się zapisać ustawień.".to_string())?;
    let next = state.current_settings();

    if previous.port != next.port || previous.bind_address != next.bind_address {
        let was_running = state.running.load(Ordering::SeqCst);
        server::stop(state.inner());
        if was_running {
            tokio::time::sleep(std::time::Duration::from_millis(180)).await;
            if let Err(error) = server::start(state.inner().clone()).await {
                eprintln!("bantrol: {error}");
                return Err(CONNECTION_ERROR.to_string());
            }
        }
    }

    Ok(state.status())
}

#[cfg(desktop)]
#[tauri::command]
fn get_status(state: State<'_, Arc<AppState>>) -> ServerStatus {
    state.status()
}

/// Re-reads the adapter's Wake-on-LAN state (used by the settings screen).
#[cfg(desktop)]
#[tauri::command]
async fn refresh_wol(state: State<'_, Arc<AppState>>) -> Result<ServerStatus, String> {
    let state = state.inner().clone();
    let status = tokio::task::spawn_blocking(power::detect_wol)
        .await
        .map_err(|error| error.to_string())?;
    state.set_wol(status);
    Ok(state.status())
}

#[cfg(desktop)]
#[tauri::command]
async fn start_server(state: State<'_, Arc<AppState>>) -> Result<ServerStatus, String> {
    if let Err(error) = server::start(state.inner().clone()).await {
        eprintln!("bantrol: {error}");
        return Err(CONNECTION_ERROR.to_string());
    }
    Ok(state.status())
}

#[cfg(desktop)]
#[tauri::command]
fn stop_server(state: State<'_, Arc<AppState>>) -> ServerStatus {
    server::stop(state.inner());
    state.status()
}

#[cfg(desktop)]
#[tauri::command]
fn regenerate_pairing_code(state: State<'_, Arc<AppState>>) -> String {
    state.regenerate_pairing_code()
}

#[cfg(desktop)]
#[tauri::command]
fn forget_device(state: State<'_, Arc<AppState>>, id: String) -> ServerStatus {
    state.forget_device(&id);
    state.status()
}

#[cfg(desktop)]
#[tauri::command]
fn clear_saved_devices(state: State<'_, Arc<AppState>>) -> ServerStatus {
    state.clear_devices();
    state.status()
}

#[cfg(desktop)]
#[tauri::command]
fn show_window(app: AppHandle) {
    reveal_main(&app);
}

#[cfg(desktop)]
#[tauri::command]
fn hide_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(desktop)]
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg(desktop)]
#[tauri::command]
fn start_dragging(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.start_dragging();
    }
}

#[cfg(desktop)]
#[tauri::command]
fn minimize_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[cfg(desktop)]
#[tauri::command]
fn toggle_maximize(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let maximized = window.is_maximized().unwrap_or(false);
        if maximized {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[cfg(desktop)]
#[tauri::command]
fn close_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

/// Opens a small, separate window that previews and controls one phone.
#[cfg(desktop)]
#[tauri::command]
fn open_phone_window(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    device_id: String,
) -> Result<(), String> {
    let safe = device_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-' || *character == '_')
        .take(48)
        .collect::<String>();
    let label = format!(
        "phone-{}",
        if safe.is_empty() { "device" } else { &safe }
    );

    if let Ok(mut controllers) = state.controllers.lock() {
        controllers.insert(label.clone(), device_id);
    }

    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("Bantrol — telefon")
        .inner_size(420.0, 820.0)
        .min_inner_size(360.0, 620.0)
        .decorations(false)
        .shadow(true)
        .resizable(true)
        .center()
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// Tells a control window which phone it belongs to.
#[cfg(desktop)]
#[tauri::command]
fn get_controller_device(state: State<'_, Arc<AppState>>, label: String) -> Option<String> {
    state
        .controllers
        .lock()
        .ok()
        .and_then(|controllers| controllers.get(&label).cloned())
}

/// Sends one control message from the desktop to a connected phone.
#[cfg(desktop)]
#[tauri::command]
fn send_phone_control(
    state: State<'_, Arc<AppState>>,
    device_id: String,
    message: serde_json::Value,
) -> Result<(), String> {
    state.send_phone(&device_id, message.to_string())
}

/// The latest state reported by the phone (screen, tab, keyboard...).
#[cfg(desktop)]
#[tauri::command]
fn get_phone_state(
    state: State<'_, Arc<AppState>>,
    device_id: String,
) -> Option<serde_json::Value> {
    state.phone_state(&device_id)
}

/// The latest desktop frame, shown inside the phone-control window.
#[cfg(desktop)]
#[tauri::command]
fn get_latest_frame(state: State<'_, Arc<AppState>>) -> Option<String> {
    use base64::Engine as _;

    let frame = state
        .latest_frame
        .read()
        .ok()
        .and_then(|frame| frame.clone())?;
    Some(format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(frame.as_slice())
    ))
}

/// The webview is a normal app window, never a browser: no devtools and no
/// right-click inspection menu.
#[cfg(target_os = "windows")]
fn harden_webview(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.with_webview(|webview| {
            let controller = webview.controller();
            unsafe {
                if let Ok(core) = controller.CoreWebView2() {
                    if let Ok(settings) = core.Settings() {
                        let _ = settings.SetAreDefaultContextMenusEnabled(false);
                        let _ = settings.SetAreDevToolsEnabled(false);
                    }
                }
            }
        });
    }
}

#[cfg(desktop)]
fn reveal_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Pokaż Bantrol", true, None::<&str>)?;
    let toggle = MenuItem::with_id(
        app,
        "toggle",
        "Włącz / wstrzymaj połączenia",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Zakończ Bantrol", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &quit])?;

    let mut builder = TrayIconBuilder::with_id("bantrol-tray")
        .menu(&menu)
        .tooltip("Bantrol — Twój komputer pod ręką")
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

pub fn run() {
    // Registered first: a second launch focuses the already running window
    // instead of starting another process.
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        reveal_main(app);
    }));

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    let builder = builder.setup(|_app| {
        #[cfg(desktop)]
        {
            let app = _app;
            let config_path = app
                .path()
                .app_config_dir()
                .map(|directory| directory.join("settings.json"))
                .unwrap_or_else(|_| PathBuf::from("bantrol-settings.json"));
            let devices_path = config_path.with_file_name("devices.json");
            let settings = Settings::load(&config_path);
            let start_minimized = settings.autostart_mode == "minimized";
            let state = Arc::new(AppState::new(settings, config_path, devices_path));
            app.manage(state.clone());

            // Detect Wake-on-LAN in the background: the PowerShell probe takes
            // a moment and must never delay the window.
            {
                let state = state.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(status) = tokio::task::spawn_blocking(power::detect_wol).await {
                        state.set_wol(status);
                    }
                });
            }

            tauri::async_runtime::spawn(async move {
                if let Err(error) = server::start(state.clone()).await {
                    if let Ok(mut slot) = state.last_error.write() {
                        *slot = Some(error);
                    }
                }
            });

            build_tray(app)?;

            #[cfg(target_os = "windows")]
            harden_webview(app.handle());

            // Launched by the system: only hide when the user picked the
            // "start minimized" option.
            let launched_by_autostart = std::env::args().any(|argument| argument == "--autostart");
            let force_hidden = std::env::args().any(|argument| argument == "--hidden");
            if force_hidden || (launched_by_autostart && start_minimized) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
        }
        Ok(())
    });

    #[cfg(desktop)]
    let builder = builder
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // Only the main window may hide to the tray; control windows
                // always close normally.
                if window.label() != "main" {
                    return;
                }
                let state = window.app_handle().state::<Arc<AppState>>();
                if state.current_settings().run_in_background {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            WindowEvent::Destroyed => {
                if window.label().starts_with("phone-") {
                    let state = window.app_handle().state::<Arc<AppState>>();
                    if let Ok(mut controllers) = state.controllers.lock() {
                        controllers.remove(window.label());
                    }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_status,
            refresh_wol,
            start_server,
            stop_server,
            regenerate_pairing_code,
            forget_device,
            clear_saved_devices,
            show_window,
            hide_window,
            quit_app,
            start_dragging,
            minimize_window,
            toggle_maximize,
            close_window,
            open_phone_window,
            get_controller_device,
            send_phone_control,
            get_phone_state,
            get_latest_frame
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("nie udało się uruchomić aplikacji Bantrol");
}
