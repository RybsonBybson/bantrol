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
    /// "off" | "normal" | "minimized"
    pub autostart_mode: String,
    pub run_in_background: bool,
    pub require_pairing: bool,
    pub remember_devices: bool,
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
            autostart_mode: "off".to_string(),
            run_in_background: true,
            require_pairing: true,
            remember_devices: true,
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
        if !matches!(self.autostart_mode.as_str(), "off" | "normal" | "minimized") {
            self.autostart_mode = "off".to_string();
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

/// A phone the user chose to remember so it can reconnect without the code.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SavedDevice {
    pub id: String,
    pub name: String,
    pub token: String,
    pub last_seen: u64,
}

impl Default for SavedDevice {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            token: String::new(),
            last_seen: 0,
        }
    }
}

/// A remembered phone, as presented to the UI. The token stays private.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedDeviceView {
    pub id: String,
    pub name: String,
    pub last_seen: u64,
    pub connected: bool,
}

/// Everything the desktop UI needs to show a friendly connection state.
/// Technical details (addresses, ports, tokens) stay out of this payload.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub pairing_code: String,
    pub pairing_link: Option<String>,
    pub clients: usize,
    pub devices: Vec<String>,
    pub device_name: String,
    pub saved_devices: Vec<SavedDeviceView>,
}

pub struct AppState {
    pub settings: RwLock<Settings>,
    pub settings_path: PathBuf,
    pub devices_path: PathBuf,
    pub saved_devices: RwLock<Vec<SavedDevice>>,
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
    pub fn new(settings: Settings, settings_path: PathBuf, devices_path: PathBuf) -> Self {
        let port = settings.port;
        let saved_devices = load_devices(&devices_path);
        Self {
            settings: RwLock::new(settings),
            settings_path,
            devices_path,
            saved_devices: RwLock::new(saved_devices),
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

    /// True when the given phone is allowed to connect with a saved token.
    pub fn verify_token(&self, id: &str, token: &str) -> bool {
        if id.is_empty() || token.is_empty() {
            return false;
        }
        self.saved_devices
            .read()
            .map(|devices| {
                devices
                    .iter()
                    .any(|device| device.id == id && device.token == token)
            })
            .unwrap_or(false)
    }

    /// Remember a phone and return the fresh token for it.
    pub fn remember_device(&self, id: &str, name: &str) -> String {
        let token = generate_token();
        let now = now_secs();
        if let Ok(mut devices) = self.saved_devices.write() {
            devices.retain(|device| device.id != id);
            devices.push(SavedDevice {
                id: id.to_string(),
                name: name.to_string(),
                token: token.clone(),
                last_seen: now,
            });
            while devices.len() > 16 {
                devices.remove(0);
            }
        }
        self.persist_devices();
        token
    }

    pub fn touch_device(&self, id: &str) {
        let now = now_secs();
        if let Ok(mut devices) = self.saved_devices.write() {
            if let Some(device) = devices.iter_mut().find(|device| device.id == id) {
                device.last_seen = now;
            }
        }
        self.persist_devices();
    }

    pub fn forget_device(&self, id: &str) {
        if let Ok(mut devices) = self.saved_devices.write() {
            devices.retain(|device| device.id != id);
        }
        self.persist_devices();
    }

    pub fn clear_devices(&self) {
        if let Ok(mut devices) = self.saved_devices.write() {
            devices.clear();
        }
        self.persist_devices();
    }

    fn persist_devices(&self) {
        if let Ok(devices) = self.saved_devices.read() {
            if let Ok(json) = serde_json::to_string_pretty(&*devices) {
                if let Some(parent) = self.devices_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&self.devices_path, json);
            }
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

        let connected = self
            .devices
            .read()
            .map(|value| value.clone())
            .unwrap_or_default();

        let saved_devices = self
            .saved_devices
            .read()
            .map(|devices| {
                devices
                    .iter()
                    .map(|device| SavedDeviceView {
                        id: device.id.clone(),
                        name: device.name.clone(),
                        last_seen: device.last_seen,
                        connected: connected.iter().any(|name| name == &device.name),
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        ServerStatus {
            running,
            pairing_code,
            pairing_link,
            clients: self.clients.load(Ordering::SeqCst),
            devices: connected,
            device_name,
            saved_devices,
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

fn load_devices(path: &Path) -> Vec<SavedDevice> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default()
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
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

fn generate_token() -> String {
    let mut bytes = [0u8; 16];
    if getrandom::fill(&mut bytes).is_ok() {
        return bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("{nanos:032x}")
}
