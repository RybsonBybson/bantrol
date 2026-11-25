import { invoke } from "@tauri-apps/api/core";

export type ThemeMode = "system" | "light" | "dark";

export interface Settings {
  theme: ThemeMode;
  autostart: boolean;
  runInBackground: boolean;
  requirePairing: boolean;
  inputEnabled: boolean;
  port: number;
  bindAddress: string;
  streamWidth: number;
  streamFps: number;
  jpegQuality: number;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  url: string | null;
  pairingCode: string;
  clients: number;
  devices: string[];
  deviceName: string;
  localIp: string | null;
  lastError: string | null;
}

export const defaultSettings: Settings = {
  theme: "system",
  autostart: false,
  runInBackground: true,
  requirePairing: true,
  inputEnabled: true,
  port: 8787,
  bindAddress: "0.0.0.0",
  streamWidth: 1280,
  streamFps: 12,
  jpegQuality: 58,
};

const demoStatus: ServerStatus = {
  running: true,
  port: 8787,
  url: "http://192.168.1.24:8787",
  pairingCode: "482913",
  clients: 1,
  devices: ["Pixel 9"],
  deviceName: "BANTROL-STUDIO",
  localIp: "192.168.1.24",
  lastError: null,
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
    return { ...demoStatus, port: settings.port, url: `http://192.168.1.24:${settings.port}` };
  }
  return invoke<ServerStatus>("save_settings", { settings });
}

export async function getStatus(): Promise<ServerStatus> {
  if (!isTauri()) return demoStatus;
  return invoke<ServerStatus>("get_status");
}

export async function startServer(): Promise<ServerStatus> {
  if (!isTauri()) return demoStatus;
  return invoke<ServerStatus>("start_server");
}

export async function stopServer(): Promise<ServerStatus> {
  if (!isTauri()) return { ...demoStatus, running: false, url: null, clients: 0, devices: [] };
  return invoke<ServerStatus>("stop_server");
}

export async function regeneratePairingCode(): Promise<string> {
  if (!isTauri()) return String(Math.floor(100000 + Math.random() * 900000));
  return invoke<string>("regenerate_pairing_code");
}

export async function hideWindow() {
  if (!isTauri()) return;
  await invoke("hide_window");
}

export async function quitApp() {
  if (!isTauri()) return;
  await invoke("quit_app");
}
