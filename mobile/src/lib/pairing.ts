export interface PairInfo {
  host: string;
  port: number;
  code: string;
  name: string;
}

const STORAGE_KEY = "bantrol.mobile.computer";

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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

export function forgetLastComputer() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
