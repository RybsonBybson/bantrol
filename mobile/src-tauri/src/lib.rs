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

/// Sends a Wake-on-LAN Magic Packet to a computer on the local network.
#[tauri::command]
async fn send_wol(
    mac: String,
    broadcast: Option<String>,
    port: Option<u16>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        wol_blocking(&mac, broadcast.as_deref(), port.unwrap_or(9))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn wol_blocking(mac: &str, broadcast: Option<&str>, port: u16) -> Result<(), String> {
    let cleaned: String = mac
        .chars()
        .filter(|character| character.is_ascii_hexdigit())
        .collect();
    if cleaned.len() != 12 {
        return Err("Nieprawidłowy adres MAC.".to_string());
    }

    let mut address = [0u8; 6];
    for (index, byte) in address.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&cleaned[index * 2..index * 2 + 2], 16)
            .map_err(|error| error.to_string())?;
    }

    // Six 0xFF bytes followed by the MAC repeated sixteen times.
    let mut packet = Vec::with_capacity(102);
    packet.extend_from_slice(&[0xFF; 6]);
    for _ in 0..16 {
        packet.extend_from_slice(&address);
    }

    let socket = UdpSocket::bind(("0.0.0.0", 0)).map_err(|error| error.to_string())?;
    socket
        .set_broadcast(true)
        .map_err(|error| error.to_string())?;

    let mut targets: Vec<String> = Vec::new();
    if let Some(broadcast) = broadcast {
        if !broadcast.trim().is_empty() {
            targets.push(format!("{}:{}", broadcast.trim(), port));
        }
    }
    targets.push(format!("255.255.255.255:{port}"));

    let mut sent = false;
    for target in targets {
        if socket.send_to(&packet, &target).is_ok() {
            sent = true;
        }
    }

    if sent {
        Ok(())
    } else {
        Err("Nie udało się wysłać pakietu wybudzającego.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![discover_computers, send_wol]);

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_barcode_scanner::init());

    builder
        .plugin(tauri_plugin_android_installer::init())
        .run(tauri::generate_context!())
        .expect("nie udało się uruchomić aplikacji Bantrol");
}
