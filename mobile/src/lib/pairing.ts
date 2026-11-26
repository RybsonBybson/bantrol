export interface PairInfo {
  host: string;
  port: number;
  code: string;
  name: string;
  deviceId?: string;
  token?: string;
  /** Wake-on-LAN data remembered from the last connection. */
  mac?: string;
  broadcast?: string;
  wolEnabled?: boolean;
}

export interface WolInfo {
  supported: boolean;
  enabled: boolean;
  mac?: string | null;
  broadcast?: string | null;
}

export interface DiscoveredComputer {
  name: string;
  host: string;
  port: number;
}

const STORAGE_KEY = "bantrol.mobile.computer";
const DEVICES_KEY = "bantrol.mobile.devices";
const DEVICE_KEY = "bantrol.mobile.deviceId";

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** A stable id for this phone, so the desktop can remember it. */
export function deviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `phone-${Math.random().toString(16).slice(2, 14)}`;
  }
}

/** Reads the pairing data encoded in the QR code shown on the desktop. */
export function parsePairingLink(raw: string): PairInfo | null {
  const value = raw.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "bantrol:") return null;

    const host = url.searchParams.get("host")?.trim() ?? "";
    const port = Number(url.searchParams.get("port") ?? "");
    const code = url.searchParams.get("code")?.trim() ?? "";
    const name = url.searchParams.get("name")?.trim() || "Komputer";
    const mac = url.searchParams.get("mac")?.trim() || undefined;
    const broadcast = url.searchParams.get("broadcast")?.trim() || undefined;
    const wol = url.searchParams.get("wol");

    if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) {
      return null;
    }

    return {
      host,
      port,
      code,
      name,
      mac,
      broadcast,
      wolEnabled: wol === "1",
    };
  } catch {
    return null;
  }
}

/** Asks the local network for desktops running Bantrol. */
export async function discoverComputers(): Promise<DiscoveredComputer[]> {
  if (!isTauri()) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<DiscoveredComputer[]>("discover_computers");
  } catch {
    return [];
  }
}

/** A key that is stable for one computer even if its address changes. */
export function deviceKey(info: PairInfo) {
  return `${info.host}:${info.port}`;
}

function readDevices(): PairInfo[] {
  try {
    const stored = localStorage.getItem(DEVICES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as PairInfo[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.host && item.port);
  } catch {
    return [];
  }
}

function writeDevices(devices: PairInfo[]) {
  try {
    localStorage.setItem(DEVICES_KEY, JSON.stringify(devices.slice(-16)));
  } catch {
    // Storage is optional; pairing still works without it.
  }
}

/** Saves or updates a computer, newest first. */
export function saveDevice(info: PairInfo): PairInfo[] {
  const key = deviceKey(info);
  const rest = readDevices().filter((item) => deviceKey(item) !== key);
  const merged: PairInfo = {
    ...info,
    deviceId: info.deviceId ?? deviceId(),
  };
  const next = [...rest, merged];
  writeDevices(next);
  saveLastComputer(merged);
  return next;
}

export function loadDevices(): PairInfo[] {
  return readDevices();
}

export function removeDevice(key: string): PairInfo[] {
  const next = readDevices().filter((item) => deviceKey(item) !== key);
  writeDevices(next);
  return next;
}

export function updateDeviceToken(key: string, token: string): PairInfo[] {
  const next = readDevices().map((item) =>
    deviceKey(item) === key ? { ...item, token } : item,
  );
  writeDevices(next);
  const current = loadLastComputer();
  if (current && deviceKey(current) === key) {
    saveLastComputer({ ...current, token });
  }
  return next;
}

export function loadLastComputer(): PairInfo | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<PairInfo>;
    if (!parsed.host || !parsed.port) return null;
    return {
      host: parsed.host,
      port: parsed.port,
      code: parsed.code ?? "",
      name: parsed.name ?? "Komputer",
      deviceId: parsed.deviceId,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

export function saveLastComputer(info: PairInfo) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    // Storage is optional; pairing still works without it.
  }
}

/** Stores the Wake-on-LAN data reported by the computer when connecting. */
export function updateDeviceWol(key: string, wol: WolInfo): PairInfo[] {
  const next = readDevices().map((item) =>
    deviceKey(item) === key
      ? {
          ...item,
          mac: wol.mac ?? item.mac,
          broadcast: wol.broadcast ?? item.broadcast,
          wolEnabled: wol.enabled,
        }
      : item,
  );
  writeDevices(next);
  return next;
}

/** Sends a Magic Packet to wake a saved computer. */
export async function wakeComputer(info: PairInfo): Promise<void> {
  if (!isTauri() || !info.mac) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("send_wol", {
    mac: info.mac,
    broadcast: info.broadcast ?? null,
    port: 9,
  });
}

export function updateLastComputerToken(token: string) {
  const current = loadLastComputer();
  if (current) saveLastComputer({ ...current, token });
}

export function forgetLastComputer() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
