use std::net::{IpAddr, SocketAddr, UdpSocket};
use std::time::{Duration, Instant};

#[derive(serde::Serialize)]
struct DiscoveredComputer {
    name: String,
    host: String,
    port: u16,
}

/// Finds Bantrol desktops on the same Wi-Fi network. The desktop answers a
/// tiny UDP ping, which lets a fresh install log in with the 6-digit code
/// without scanning the QR first.
#[tauri::command]
async fn discover_computers() -> Vec<DiscoveredComputer> {
    tauri::async_runtime::spawn_blocking(discover_blocking)
        .await
        .unwrap_or_default()
}

fn discover_blocking() -> Vec<DiscoveredComputer> {
    let socket = match UdpSocket::bind(("0.0.0.0", 0)) {
        Ok(socket) => socket,
        Err(_) => return Vec::new(),
    };
    let _ = socket.set_broadcast(true);
    let _ = socket.set_read_timeout(Some(Duration::from_millis(250)));

    let mut targets = vec![SocketAddr::from(([255, 255, 255, 255], 47823))];
    if let Ok(probe) = UdpSocket::bind(("0.0.0.0", 0)) {
        if probe.connect(("8.8.8.8", 80)).is_ok() {
            if let Ok(local) = probe.local_addr() {
                if let IpAddr::V4(ip) = local.ip() {
                    let octets = ip.octets();
                    let broadcast =
                        SocketAddr::from(([octets[0], octets[1], octets[2], 255], 47823));
                    if !targets.contains(&broadcast) {
                        targets.push(broadcast);
                    }
                }
            }
        }
    }

    for target in targets {
        let _ = socket.send_to(b"BANTROL_DISCOVER", target);
    }

    let deadline = Instant::now() + Duration::from_millis(1600);
    let mut found: Vec<DiscoveredComputer> = Vec::new();
    while Instant::now() < deadline {
        let mut buffer = [0u8; 512];
        match socket.recv_from(&mut buffer) {
            Ok((length, address)) => {
                let Ok(value) = serde_json::from_slice::<serde_json::Value>(&buffer[..length])
                else {
                    continue;
                };
                if value["app"].as_str() != Some("bantrol") {
                    continue;
                }
                let port = value["port"].as_u64().unwrap_or(0);
                if !(1..=65535).contains(&port) {
                    continue;
                }
                let host = address.ip().to_string();
                let port = port as u16;
                if found
                    .iter()
                    .any(|item| item.host == host && item.port == port)
                {
                    continue;
                }
                found.push(DiscoveredComputer {
                    name: value["name"]
                        .as_str()
                        .unwrap_or("Komputer")
                        .to_string(),
                    host,
                    port,
                });
            }
            Err(error)
                if error.kind() == std::io::ErrorKind::WouldBlock
                    || error.kind() == std::io::ErrorKind::TimedOut =>
            {
                continue;
            }
            Err(_) => break,
        }
    }

    found
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![discover_computers]);

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_barcode_scanner::init());

    builder
        .plugin(tauri_plugin_android_installer::init())
        .run(tauri::generate_context!())
        .expect("nie udało się uruchomić aplikacji Bantrol");
}
