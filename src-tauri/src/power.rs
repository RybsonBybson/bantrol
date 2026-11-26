//! Power management: Wake-on-LAN discovery and system power actions.
//!
//! Wake-on-LAN is detected from Windows itself (the active network adapter's
//! power-management settings, with a registry fallback) so the phone can be
//! told whether waking the computer is possible, together with the address it
//! needs to send the Magic Packet to.

use serde::Serialize;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// What the UI needs to know about Wake-on-LAN for this computer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WolStatus {
    /// The adapter was found and its Wake-on-LAN capability could be read.
    pub supported: bool,
    /// Wake on Magic Packet is turned on for the adapter.
    pub enabled: bool,
    /// The adapter's MAC address, when known.
    pub mac: Option<String>,
    /// The subnet broadcast address used to reach the whole local network.
    pub broadcast: Option<String>,
}

impl Default for WolStatus {
    fn default() -> Self {
        Self {
            supported: false,
            enabled: false,
            mac: None,
            broadcast: None,
        }
    }
}

/// Reads the Wake-on-LAN state of the active network adapter.
pub fn detect_wol() -> WolStatus {
    #[cfg(target_os = "windows")]
    {
        detect_wol_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Wake-on-LAN reporting is only wired up on Windows for now; other
        // systems can still receive power actions.
        WolStatus::default()
    }
}

#[cfg(target_os = "windows")]
const PROBE: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1
if (-not $route) { '{}'; exit }
$adapter = Get-NetAdapter -InterfaceIndex $route.InterfaceIndex
$pm = Get-NetAdapterPowerManagement -InterfaceDescription $adapter.InterfaceDescription
$ip = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1
$reg = $null
$base = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}'
Get-ChildItem $base | ForEach-Object { $p = Get-ItemProperty $_.PSPath; if ($p.NetCfgInstanceId -eq $adapter.InterfaceGuid) { $reg = $p } }
$magic = $null
$magicPlain = $null
$disable = $null
if ($reg) {
  $magic = $reg.'*WakeOnMagicPacket'
  $magicPlain = $reg.WakeOnMagicPacket
  $disable = $reg.DisableWakeOnMagic
}
[pscustomobject]@{
  mac = $adapter.MacAddress
  pm = [string]$pm.WakeOnMagicPacket
  magic = $magic
  magicPlain = $magicPlain
  disable = $disable
  ip = $ip.IPAddress
  prefix = $ip.PrefixLength
} | ConvertTo-Json -Compress
"#;

#[cfg(target_os = "windows")]
fn detect_wol_windows() -> WolStatus {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            PROBE,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let output = match output {
        Ok(output) => output,
        Err(_) => return WolStatus::default(),
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let (start, end) = match (text.find('{'), text.rfind('}')) {
        (Some(start), Some(end)) if end > start => (start, end),
        _ => return WolStatus::default(),
    };
    let json: serde_json::Value = match serde_json::from_str(&text[start..=end]) {
        Ok(value) => value,
        Err(_) => return WolStatus::default(),
    };

    let mac = json["mac"]
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string());

    let pm = json["pm"].as_str().unwrap_or("").to_ascii_lowercase();
    let magic = as_int(&json["magic"]);
    let magic_plain = as_int(&json["magicPlain"]);

    let enabled = if pm.contains("disabled") {
        false
    } else if pm.contains("enabled") {
        true
    } else {
        magic
            .or(magic_plain)
            .map(|value| value != 0)
            .unwrap_or(false)
    };

    let broadcast = match (json["ip"].as_str(), as_int(&json["prefix"])) {
        (Some(ip), Some(prefix)) if prefix >= 0 => subnet_broadcast(ip, prefix as u32),
        _ => None,
    };

    WolStatus {
        supported: mac.is_some(),
        enabled,
        mac,
        broadcast,
    }
}

/// Reads a JSON number that may be encoded either as a number or a string,
/// because Windows registry values reach PowerShell both ways.
#[cfg(target_os = "windows")]
fn as_int(value: &serde_json::Value) -> Option<i64> {
    if let Some(number) = value.as_i64() {
        return Some(number);
    }
    value.as_str()?.trim().parse::<i64>().ok()
}

/// Turns an IP + prefix length into the subnet broadcast address.
#[cfg(target_os = "windows")]
fn subnet_broadcast(ip: &str, prefix: u32) -> Option<String> {
    let address: std::net::Ipv4Addr = ip.trim().parse().ok()?;
    let prefix = prefix.min(32);
    let mask: u32 = if prefix == 0 {
        0
    } else {
        u32::MAX << (32 - prefix)
    };
    let broadcast = u32::from(address) | !mask;
    Some(std::net::Ipv4Addr::from(broadcast).to_string())
}

/// Runs one of the supported power actions. The process is spawned and not
/// waited on, because a shutdown or sleep tears the app down with it.
pub fn run_power_action(action: &str) -> Result<(), String> {
    match action {
        "sleep" | "shutdown" | "restart" | "hibernate" | "lock" => {}
        _ => return Err("Nieznana czynność zasilania.".to_string()),
    }

    #[cfg(target_os = "windows")]
    {
        match action {
            "sleep" => run("rundll32.exe", &["powrprof.dll,SetSuspendState", "0,1,0"]),
            "hibernate" => run("shutdown", &["/h"]),
            "shutdown" => run("shutdown", &["/s", "/t", "0"]),
            "restart" => run("shutdown", &["/r", "/t", "0"]),
            "lock" => run("rundll32.exe", &["user32.dll,LockWorkStation"]),
            _ => Ok(()),
        }
    }

    #[cfg(target_os = "macos")]
    {
        match action {
            "sleep" | "hibernate" => run("pmset", &["sleepnow"]),
            "shutdown" => run("shutdown", &["-s", "now"]),
            "restart" => run("shutdown", &["-r", "now"]),
            "lock" => run("pmset", &["displaysleepnow"]),
            _ => Ok(()),
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        match action {
            "sleep" => run("systemctl", &["suspend"]),
            "hibernate" => run("systemctl", &["hibernate"]),
            "shutdown" => run("systemctl", &["poweroff"]),
            "restart" => run("systemctl", &["reboot"]),
            "lock" => run("loginctl", &["lock-session"]),
            _ => Ok(()),
        }
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::subnet_broadcast;

    #[test]
    fn computes_subnet_broadcast() {
        assert_eq!(
            subnet_broadcast("192.168.1.24", 24).as_deref(),
            Some("192.168.1.255")
        );
        assert_eq!(
            subnet_broadcast("10.88.12.222", 24).as_deref(),
            Some("10.88.12.255")
        );
        assert_eq!(
            subnet_broadcast("10.2.1.164", 16).as_deref(),
            Some("10.2.255.255")
        );
    }
}

#[cfg(any(target_os = "windows", target_os = "macos", unix))]
fn run(program: &str, args: &[&str]) -> Result<(), String> {
    let mut command = Command::new(program);
    command.args(args);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}
