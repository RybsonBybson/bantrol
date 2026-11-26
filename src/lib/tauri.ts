import { invoke } from "@tauri-apps/api/core";

export type ThemeMode = "system" | "light" | "dark";
export type AutostartMode = "off" | "normal" | "minimized";

export interface Settings {
  theme: ThemeMode;
  autostartMode: AutostartMode;
  runInBackground: boolean;
  requirePairing: boolean;
  rememberDevices: boolean;
  inputEnabled: boolean;
  port: number;
  bindAddress: string;
  streamWidth: number;
  streamFps: number;
  jpegQuality: number;
}

export interface SavedDevice {
  id: string;
  name: string;
  lastSeen: number;
  connected: boolean;
}

export interface WolStatus {
  supported: boolean;
  enabled: boolean;
  mac: string | null;
  broadcast: string | null;
}

export interface ServerStatus {
  running: boolean;
  pairingCode: string;
  pairingLink: string | null;
  clients: number;
  devices: string[];
  deviceName: string;
  savedDevices: SavedDevice[];
  wol: WolStatus;
}

export interface PhoneState {
  screen?: "boot" | "pair" | "connecting" | "remote";
  tab?: "pair" | "devices";
  keyboard?: boolean;
  inputEnabled?: boolean;
  name?: string;
  devices?: Array<{ name: string; online?: boolean }>;
}

export const defaultSettings: Settings = {
  theme: "system",
  autostartMode: "off",
  runInBackground: true,
  requirePairing: true,
  rememberDevices: true,
  inputEnabled: true,
  port: 8787,
  bindAddress: "0.0.0.0",
  streamWidth: 1280,
  streamFps: 12,
  jpegQuality: 58,
};

const demoDevices: SavedDevice[] = [
  { id: "demo-1", name: "Pixel 9", lastSeen: 0, connected: true },
];

const demoStatus: ServerStatus = {
  running: true,
  pairingCode: "482913",
  pairingLink:
    "bantrol://pair?host=192.168.1.24&port=8787&code=482913&name=BANTROL-STUDIO",
  clients: 1,
  devices: ["Pixel 9"],
  deviceName: "BANTROL-STUDIO",
  savedDevices: demoDevices,
  wol: { supported: true, enabled: true, mac: "D8-B3-2F-5D-36-91", broadcast: "192.168.1.255" },
};

const DEMO_KEY = "bantrol.demo.settings";

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function loadDemoSettings(): Settings {
  if (typeof localStorage === "undefined") return defaultSettings;
  try {
    const stored = localStorage.getItem(DEMO_KEY);
    if (!stored) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(stored) as Partial<Settings>) };
  } catch {
    return defaultSettings;
  }
}

function storeDemoSettings(settings: Settings) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures when previewing in a regular browser.
  }
}

export async function getSettings(): Promise<Settings> {
  if (!isTauri()) return loadDemoSettings();
  return invoke<Settings>("get_settings");
}

export async function saveSettings(settings: Settings): Promise<ServerStatus> {
  if (!isTauri()) {
    storeDemoSettings(settings);
    return demoStatus;
  }
  return invoke<ServerStatus>("save_settings", { settings });
}

export async function getStatus(): Promise<ServerStatus> {
  if (!isTauri()) return demoStatus;
  return invoke<ServerStatus>("get_status");
}

export async function refreshWol(): Promise<ServerStatus> {
  if (!isTauri()) return demoStatus;
  return invoke<ServerStatus>("refresh_wol");
}

export async function startServer(): Promise<ServerStatus> {
  if (!isTauri()) return demoStatus;
  return invoke<ServerStatus>("start_server");
}

export async function stopServer(): Promise<ServerStatus> {
  if (!isTauri()) {
    return { ...demoStatus, running: false, pairingLink: null, clients: 0, devices: [] };
  }
  return invoke<ServerStatus>("stop_server");
}

export async function regeneratePairingCode(): Promise<string> {
  if (!isTauri()) return String(Math.floor(100000 + Math.random() * 900000));
  return invoke<string>("regenerate_pairing_code");
}

export async function forgetDevice(id: string): Promise<ServerStatus> {
  if (!isTauri()) {
    return {
      ...demoStatus,
      savedDevices: demoStatus.savedDevices.filter((device) => device.id !== id),
    };
  }
  return invoke<ServerStatus>("forget_device", { id });
}

export async function clearSavedDevices(): Promise<ServerStatus> {
  if (!isTauri()) return { ...demoStatus, savedDevices: [] };
  return invoke<ServerStatus>("clear_saved_devices");
}

export async function hideWindow() {
  if (!isTauri()) return;
  await invoke("hide_window");
}

export async function quitApp() {
  if (!isTauri()) return;
  await invoke("quit_app");
}

export async function startDragging() {
  if (!isTauri()) return;
  await invoke("start_dragging");
}

export async function minimizeWindow() {
  if (!isTauri()) return;
  await invoke("minimize_window");
}

export async function toggleMaximize() {
  if (!isTauri()) return;
  await invoke("toggle_maximize");
}

export async function closeWindow() {
  if (!isTauri()) return;
  await invoke("close_window");
}

/** The app version comes from the build, never from a hardcoded label. */
export async function getAppVersion(): Promise<string> {
  if (!isTauri()) return __APP_VERSION__;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return __APP_VERSION__;
  }
}

export async function openPhoneWindow(deviceId: string) {
  if (!isTauri()) return;
  await invoke("open_phone_window", { deviceId });
}

export async function getControllerDevice(
  label: string,
): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("get_controller_device", { label });
}

export async function sendPhoneControl(
  deviceId: string,
  message: Record<string, unknown>,
) {
  if (!isTauri()) return;
  await invoke("send_phone_control", {
    deviceId,
    message: { type: "control", ...message },
  });
}

export async function getPhoneState(
  deviceId: string,
): Promise<PhoneState | null> {
  if (!isTauri()) return null;
  return invoke<PhoneState | null>("get_phone_state", { deviceId });
}

export async function getLatestFrame(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("get_latest_frame");
}
