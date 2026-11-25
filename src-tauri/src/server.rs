use crate::settings::{AppState, Settings};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use enigo::{Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, oneshot};

#[derive(Clone)]
struct Ctx {
    state: Arc<AppState>,
    frames: broadcast::Sender<Arc<Vec<u8>>>,
}

/// Start the local Wi-Fi server. Safe to call when the server is already running.
pub async fn start(state: Arc<AppState>) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Ok(());
    }

    let settings = state.current_settings();
    let address = format!("{}:{}", settings.bind_address, settings.port);
    let listener = tokio::net::TcpListener::bind(&address)
        .await
        .map_err(|error| format!("Nie można otworzyć portu {address}: {error}"))?;
    let bound_port = listener
        .local_addr()
        .map(|value| value.port())
        .unwrap_or(settings.port);

    let (frame_tx, _receiver) = broadcast::channel(4);
    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    {
        let mut guard = state.shutdown.lock().unwrap_or_else(|error| error.into_inner());
        *guard = Some(shutdown_tx);
    }
    {
        let mut guard = state.frame_tx.write().unwrap_or_else(|error| error.into_inner());
        *guard = Some(frame_tx.clone());
    }
    {
        let mut port = state.port.write().unwrap_or_else(|error| error.into_inner());
        *port = bound_port;
    }
    {
        let mut error = state.last_error.write().unwrap_or_else(|error| error.into_inner());
        *error = None;
    }
    state.running.store(true, Ordering::SeqCst);

    let ctx = Ctx {
        state: state.clone(),
        frames: frame_tx.clone(),
    };
    // Only the mobile app connects here. Browsers are intentionally rejected so
    // the desktop never exposes a web controller.
    let router = Router::new()
        .route("/ws", get(ws_handler))
        .fallback(not_found)
        .with_state(ctx);

    let server_state = state.clone();
    tauri::async_runtime::spawn(async move {
        let result = axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
        server_state.running.store(false, Ordering::SeqCst);
        server_state.reset_clients();
        if let Err(error) = result {
            if let Ok(mut slot) = server_state.last_error.write() {
                *slot = Some(error.to_string());
            }
        }
    });

    spawn_capture_loop(state, frame_tx);
    Ok(())
}

/// Ask the server and the capture loop to stop.
pub fn stop(state: &AppState) {
    state.running.store(false, Ordering::SeqCst);
    if let Some(sender) = state
        .shutdown
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .take()
    {
        let _ = sender.send(());
    }
    state.reset_clients();
    if let Ok(mut slot) = state.frame_tx.write() {
        *slot = None;
    }
}

async fn not_found() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        "Połącz się przez aplikację Bantrol na telefonie.",
    )
}

async fn ws_handler(ws: WebSocketUpgrade, State(ctx): State<Ctx>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, ctx))
}

async fn handle_socket(socket: WebSocket, ctx: Ctx) {
    let (mut sender, mut receiver) = socket.split();

    let first = match receiver.next().await {
        Some(Ok(Message::Text(text))) => text.to_string(),
        _ => return,
    };
    let hello: Value = match serde_json::from_str(&first) {
        Ok(value) => value,
        Err(_) => return,
    };

    if hello["type"].as_str() != Some("hello") {
        let _ = send_error(&mut sender, "Oczekiwano komunikatu powitalnego.").await;
        return;
    }

    let device = hello["name"]
        .as_str()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or("Telefon")
        .chars()
        .take(48)
        .collect::<String>();

    let device_id = hello["deviceId"]
        .as_str()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(64).collect::<String>())
        .unwrap_or_else(|| device.clone());

    let settings = ctx.state.current_settings();
    let mut authorized = !settings.require_pairing;

    // A phone the user already trusted may reconnect with its saved token,
    // skipping the pairing code entirely.
    if !authorized {
        if let Some(token) = hello["token"]
            .as_str()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            if ctx.state.verify_token(&device_id, token) {
                authorized = true;
                ctx.state.touch_device(&device_id);
            }
        }
    }

    if !authorized {
        let provided = hello["code"].as_str().unwrap_or("").trim();
        if !provided.is_empty() && provided == ctx.state.pairing_code() {
            authorized = true;
        }
    }

    if !authorized {
        let _ = send_error(&mut sender, "Nieprawidłowy kod parowania.").await;
        let _ = sender.close().await;
        return;
    }

    let issued_token = if settings.remember_devices {
        Some(ctx.state.remember_device(&device_id, &device))
    } else {
        None
    };

    ctx.state.add_device(device.clone());

    let ready = json!({
        "type": "ready",
        "deviceName": crate::settings::device_name(),
        "inputEnabled": settings.input_enabled,
        "streamFps": settings.stream_fps,
        "clients": ctx.state.clients.load(Ordering::SeqCst),
        "token": issued_token,
    });
    if sender
        .send(Message::Text(ready.to_string().into()))
        .await
        .is_err()
    {
        ctx.state.remove_device(&device);
        return;
    }

    let mut frames = ctx.frames.subscribe();

    loop {
        tokio::select! {
            frame = frames.recv() => {
                match frame {
                    Ok(bytes) => {
                        if sender.send(Message::Binary((*bytes).clone().into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            incoming = receiver.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => handle_client_message(&ctx, &text).await,
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {}
                }
            }
        }
    }

    ctx.state.remove_device(&device);
}

async fn send_error(
    sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    message: &str,
) -> Result<(), axum::Error> {
    sender
        .send(Message::Text(
            json!({ "type": "error", "message": message })
                .to_string()
                .into(),
        ))
        .await
}

async fn handle_client_message(ctx: &Ctx, text: &str) {
    let Ok(message) = serde_json::from_str::<Value>(text) else {
        return;
    };
    let settings = ctx.state.current_settings();
    if !settings.input_enabled {
        return;
    }

    match message["type"].as_str() {
        Some("pointer") => {
            let action = message["action"].as_str().unwrap_or("").to_string();
            let x = message["x"].as_f64();
            let y = message["y"].as_f64();
            let button = message["button"].as_str().unwrap_or("left").to_string();
            let dx = message["dx"].as_f64().unwrap_or(0.0);
            let dy = message["dy"].as_f64().unwrap_or(0.0);
            let screen = ctx
                .state
                .screen
                .read()
                .map(|value| *value)
                .unwrap_or((1920, 1080));
            let _ = tokio::task::spawn_blocking(move || {
                run_pointer(&action, x, y, &button, dx, dy, screen)
            })
            .await;
        }
        Some("key") => {
            let key = message["key"].as_str().unwrap_or("").to_string();
            let _ = tokio::task::spawn_blocking(move || run_key(&key)).await;
        }
        Some("text") => {
            let text = message["text"].as_str().unwrap_or("").chars().take(512).collect::<String>();
            let _ = tokio::task::spawn_blocking(move || run_text(&text)).await;
        }
        _ => {}
    }
}

fn enigo() -> Result<Enigo, String> {
    Enigo::new(&enigo::Settings::default()).map_err(|error| error.to_string())
}

fn run_pointer(
    action: &str,
    x: Option<f64>,
    y: Option<f64>,
    button: &str,
    dx: f64,
    dy: f64,
    screen: (u32, u32),
) -> Result<(), String> {
    let mut engine = enigo()?;
    let (width, height) = (screen.0.max(1) as f64, screen.1.max(1) as f64);

    if let (Some(nx), Some(ny)) = (x, y) {
        let px = (nx.clamp(0.0, 1.0) * (width - 1.0)).round() as i32;
        let py = (ny.clamp(0.0, 1.0) * (height - 1.0)).round() as i32;
        engine
            .move_mouse(px, py, Coordinate::Abs)
            .map_err(|error| error.to_string())?;
    }

    match action {
        "move" => {}
        "click" => {
            engine
                .button(mouse_button(button), Direction::Click)
                .map_err(|error| error.to_string())?;
        }
        "down" => {
            engine
                .button(mouse_button(button), Direction::Press)
                .map_err(|error| error.to_string())?;
        }
        "up" => {
            engine
                .button(mouse_button(button), Direction::Release)
                .map_err(|error| error.to_string())?;
        }
        "scroll" => {
            let vertical = (-dy / 42.0).round() as i32;
            let horizontal = (dx / 42.0).round() as i32;
            if vertical != 0 {
                engine
                    .scroll(vertical, Axis::Vertical)
                    .map_err(|error| error.to_string())?;
            }
            if horizontal != 0 {
                engine
                    .scroll(horizontal, Axis::Horizontal)
                    .map_err(|error| error.to_string())?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn mouse_button(button: &str) -> Button {
    match button {
        "right" => Button::Right,
        "middle" => Button::Middle,
        "back" => Button::Back,
        "forward" => Button::Forward,
        _ => Button::Left,
    }
}

fn run_key(name: &str) -> Result<(), String> {
    let key = match name.to_lowercase().as_str() {
        "enter" | "return" => Key::Return,
        "backspace" => Key::Backspace,
        "escape" | "esc" => Key::Escape,
        "tab" => Key::Tab,
        "space" => Key::Space,
        "delete" | "del" => Key::Delete,
        "up" | "arrowup" => Key::UpArrow,
        "down" | "arrowdown" => Key::DownArrow,
        "left" | "arrowleft" => Key::LeftArrow,
        "right" | "arrowright" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "meta" | "win" | "cmd" => Key::Meta,
        "control" | "ctrl" => Key::Control,
        "alt" => Key::Alt,
        "shift" => Key::Shift,
        other => {
            let mut chars = other.chars();
            match (chars.next(), chars.next()) {
                (Some(character), None) => Key::Unicode(character),
                _ => return Ok(()),
            }
        }
    };
    let mut engine = enigo()?;
    engine
        .key(key, Direction::Click)
        .map_err(|error| error.to_string())
}

fn run_text(text: &str) -> Result<(), String> {
    let mut engine = enigo()?;
    engine.text(text).map_err(|error| error.to_string())
}

fn spawn_capture_loop(state: Arc<AppState>, frames: broadcast::Sender<Arc<Vec<u8>>>) {
    tauri::async_runtime::spawn(async move {
        loop {
            if !state.running.load(Ordering::SeqCst) {
                break;
            }

            let clients = state.clients.load(Ordering::SeqCst);
            if clients == 0 {
                tokio::time::sleep(Duration::from_millis(450)).await;
                continue;
            }

            let settings: Settings = state.current_settings();
            let width = settings.stream_width;
            let quality = settings.jpeg_quality;

            match tokio::task::spawn_blocking(move || capture_frame(width, quality)).await {
                Ok(Ok((jpeg, native_width, native_height))) => {
                    if let Ok(mut screen) = state.screen.write() {
                        *screen = (native_width, native_height);
                    }
                    let _ = frames.send(Arc::new(jpeg));
                }
                Ok(Err(_)) => {
                    tokio::time::sleep(Duration::from_millis(900)).await;
                }
                Err(_) => {}
            }

            let fps = settings.stream_fps.clamp(1, 30);
            tokio::time::sleep(Duration::from_millis(1000 / fps as u64)).await;
        }
    });
}

fn capture_frame(max_width: u32, quality: u8) -> Result<(Vec<u8>, u32, u32), String> {
    let screens = screenshots::Screen::all().map_err(|error| error.to_string())?;
    let screen = screens
        .into_iter()
        .next()
        .ok_or_else(|| "Nie wykryto żadnego ekranu.".to_string())?;
    let image = screen.capture().map_err(|error| error.to_string())?;
    let (width, height) = (image.width(), image.height());
    if width == 0 || height == 0 {
        return Err("Ekran zwrócił pusty obraz.".to_string());
    }

    let raw = image.into_raw();
    let (data, out_width, out_height) = downscale(&raw, width, height, max_width);
    let mut buffer = Vec::new();
    jpeg_encoder::Encoder::new(&mut buffer, quality.clamp(30, 90))
        .encode(
            &data,
            out_width as u16,
            out_height as u16,
            jpeg_encoder::ColorType::Rgba,
        )
        .map_err(|error| error.to_string())?;

    Ok((buffer, width, height))
}

fn downscale(
    raw: &[u8],
    width: u32,
    height: u32,
    max_width: u32,
) -> (Vec<u8>, u32, u32) {
    let max_width = max_width.clamp(320, 2560);
    if width <= max_width {
        return (raw.to_vec(), width, height);
    }

    let out_width = max_width;
    let out_height = ((height as f64 * (out_width as f64 / width as f64)).round() as u32).max(2);
    let mut out = vec![0u8; (out_width * out_height * 4) as usize];
    let stride = width as usize * 4;
    let out_stride = out_width as usize * 4;

    for row in 0..out_height {
        let source_row = (row as u64 * height as u64 / out_height as u64) as usize;
        let source = source_row * stride;
        let destination = row as usize * out_stride;
        for column in 0..out_width {
            let source_column = (column as u64 * width as u64 / out_width as u64) as usize * 4;
            let from = source + source_column;
            let to = destination + column as usize * 4;
            out[to..to + 4].copy_from_slice(&raw[from..from + 4]);
        }
    }

    (out, out_width, out_height)
}
