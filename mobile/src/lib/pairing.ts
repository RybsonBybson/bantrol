export interface PairInfo {
  host: string;
  port: number;
  code: string;
  name: string;
  deviceId?: string;
  token?: string;
}

const STORAGE_KEY = "bantrol.mobile.computer";
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

    if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) {
      return null;
    }

    return { host, port, code, name };
  } catch {
    return null;
  }
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
