use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::broadcast;

/// User-facing configuration, persisted as JSON in the app config directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: String,
    pub autostart: bool,
    pub run_in_background: bool,
    pub require_pairing: bool,
    pub input_enabled: bool,
    pub port: u16,
    pub bind_address: String,
    pub stream_width: u32,
    pub stream_fps: u32,
    pub jpeg_quality: u8,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            autostart: false,
            run_in_background: true,
            require_pairing: true,
            input_enabled: true,
            port: 8787,
            bind_address: "0.0.0.0".to_string(),
            stream_width: 1280,
            stream_fps: 12,
            jpeg_quality: 58,
        }
    }
}

impl Settings {
    pub fn load(path: &Path) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|contents| serde_json::from_str(&contents).ok())
            .unwrap_or_default()
    }

    pub fn store(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|error| error.to_string())?;
        std::fs::write(path, json).map_err(|error| error.to_string())
    }

    pub fn sanitized(mut self) -> Self {
        if self.theme != "light" && self.theme != "dark" {
            self.theme = "system".to_string();
        }
        self.port = self.port.clamp(1024, 65535);
        if self.bind_address.trim().is_empty() {
            self.bind_address = "0.0.0.0".to_string();
        }
        self.stream_width = self.stream_width.clamp(480, 2560);
        self.stream_fps = self.stream_fps.clamp(1, 30);
        self.jpeg_quality = self.jpeg_quality.clamp(30, 90);
        self
    }
}

/// Everything the desktop UI needs to show a friendly connection state.
/// Technical details (addresses, ports, protocol info) stay out of this payload.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub pairing_code: String,
    pub pairing_link: Option<String>,
    pub clients: usize,
    pub devices: Vec<String>,
    pub device_name: String,
}

pub struct AppState {
    pub settings: RwLock<Settings>,
    pub settings_path: PathBuf,
    pub pairing_code: RwLock<String>,
    pub clients: AtomicUsize,
    pub devices: RwLock<Vec<String>>,
    pub running: AtomicBool,
    pub port: RwLock<u16>,
    pub last_error: RwLock<Option<String>>,
    pub screen: RwLock<(u32, u32)>,
    pub shutdown: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    pub frame_tx: RwLock<Option<broadcast::Sender<Arc<Vec<u8>>>>>,
}

impl AppState {
    pub fn new(settings: Settings, settings_path: PathBuf) -> Self {
        let port = settings.port;
        Self {
            settings: RwLock::new(settings),
            settings_path,
            pairing_code: RwLock::new(generate_pairing_code()),
            clients: AtomicUsize::new(0),
            devices: RwLock::new(Vec::new()),
            running: AtomicBool::new(false),
            port: RwLock::new(port),
            last_error: RwLock::new(None),
            screen: RwLock::new((1920, 1080)),
            shutdown: Mutex::new(None),
            frame_tx: RwLock::new(None),
        }
    }

    pub fn current_settings(&self) -> Settings {
        self.settings.read().map(|value| value.clone()).unwrap_or_default()
    }

    pub fn replace_settings(&self, next: Settings) -> Result<(), String> {
        let next = next.sanitized();
        next.store(&self.settings_path)?;
        if let Ok(mut guard) = self.settings.write() {
            *guard = next;
        }
        Ok(())
    }

    pub fn pairing_code(&self) -> String {
        self.pairing_code
            .read()
            .map(|value| value.clone())
            .unwrap_or_else(|_| "------".to_string())
    }

    pub fn regenerate_pairing_code(&self) -> String {
        let code = generate_pairing_code();
        if let Ok(mut guard) = self.pairing_code.write() {
            *guard = code.clone();
        }
        code
    }

    pub fn add_device(&self, name: String) {
        self.clients.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut devices) = self.devices.write() {
            if devices.len() < 16 {
                devices.push(name);
            }
        }
    }

    pub fn remove_device(&self, name: &str) {
        let _ = self
            .clients
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |value| {
                Some(value.saturating_sub(1))
            });
        if let Ok(mut devices) = self.devices.write() {
            if let Some(index) = devices.iter().position(|device| device == name) {
                devices.remove(index);
            }
        }
    }

    pub fn reset_clients(&self) {
        self.clients.store(0, Ordering::SeqCst);
        if let Ok(mut devices) = self.devices.write() {
            devices.clear();
        }
    }

    pub fn local_ip(&self) -> Option<std::net::IpAddr> {
        local_ip_address::local_ip().ok()
    }

    pub fn status(&self) -> ServerStatus {
        let running = self.running.load(Ordering::SeqCst);
        let port = *self.port.read().unwrap_or_else(|error| error.into_inner());
        let bind_address = self.current_settings().bind_address;
        let pairing_code = self.pairing_code();
        let device_name = device_name();

        let host = if bind_address.is_empty() || bind_address == "0.0.0.0" {
            self.local_ip().map(|address| address.to_string())
        } else {
            Some(bind_address)
        };

        let pairing_link = if running {
            host.map(|host| {
                format!(
                    "bantrol://pair?host={}&port={}&code={}&name={}",
                    urlencoding::encode(&host),
                    port,
                    pairing_code,
                    urlencoding::encode(&device_name)
                )
            })
        } else {
            None
        };

        ServerStatus {
            running,
            pairing_code,
            pairing_link,
            clients: self.clients.load(Ordering::SeqCst),
            devices: self
                .devices
                .read()
                .map(|value| value.clone())
                .unwrap_or_default(),
            device_name,
        }
    }
}

pub fn device_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Bantrol".to_string())
}

fn generate_pairing_code() -> String {
    let mut bytes = [0u8; 4];
    if getrandom::fill(&mut bytes).is_ok() {
        return format!("{:06}", u32::from_le_bytes(bytes) % 1_000_000);
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("{:06}", (nanos / 97) % 1_000_000)
}
