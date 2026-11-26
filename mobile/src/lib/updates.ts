import { isTauri } from "@/lib/pairing";

const API = "https://api.github.com/repos/RybsonBybson/bantrol/releases/latest";
const RELEASES = "https://github.com/RybsonBybson/bantrol/releases/latest";

export interface MobileUpdate {
  version: string;
  /** Direct APK download URL (or the release page as a fallback). */
  url: string;
  pageUrl: string;
}

export function compareVersions(a: string, b: string) {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface Release {
  tag_name?: string;
  html_url?: string;
  assets?: ReleaseAsset[];
}

export async function checkMobileUpdate(
  current = "0.1.0",
): Promise<MobileUpdate | null> {
  try {
    const response = await fetch(API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;

    const release = (await response.json()) as Release;
    const version = release.tag_name?.replace(/^v/i, "");
    if (!version || compareVersions(version, current) <= 0) return null;

    const apk = release.assets?.find((asset) => /\.apk$/i.test(asset.name));
    return {
      version,
      url: apk?.browser_download_url ?? release.html_url ?? RELEASES,
      pageUrl: release.html_url ?? RELEASES,
    };
  } catch {
    return null;
  }
}

export async function openInBrowser(url: string) {
  if (isTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch {
      // Fall back to a normal link below.
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

async function readBody(
  response: Response,
  onProgress: (percent: number) => void,
): Promise<Uint8Array> {
  const total = Number(response.headers.get("content-length") ?? 0);
  const reader = response.body?.getReader?.();

  if (!reader) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (total > 0) {
        onProgress(Math.min(99, Math.round((received / total) * 100)));
      }
    }
  }

  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Downloads the new APK into the app cache and launches the system installer.
 * The installer is allowed to replace the current app only when both builds
 * use the same signing key, which the release workflow guarantees by shipping
 * a stable debug keystore.
 */
export async function downloadAndInstall(
  update: MobileUpdate,
  onProgress: (percent: number) => void,
) {
  if (!isTauri()) {
    await openInBrowser(update.url);
    return;
  }

  try {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    const { writeFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const { appCacheDir, join } = await import("@tauri-apps/api/path");
    const { invoke } = await import("@tauri-apps/api/core");

    const response = await tauriFetch(update.url, {
      headers: { Accept: "application/octet-stream" },
    });
    if (!response.ok) throw new Error("download-failed");

    const bytes = await readBody(response, onProgress);
    onProgress(100);

    const fileName = `bantrol-${update.version}.apk`;
    await writeFile(fileName, bytes, { baseDir: BaseDirectory.AppCache });
    const filePath = await join(await appCacheDir(), fileName);

    let allowed = true;
    try {
      allowed = await invoke<boolean>("plugin:android-installer|can_install");
    } catch {
      // The plugin is missing (old build); try the installer anyway.
    }

    if (!allowed) {
      await invoke("plugin:android-installer|request_install_permission");
      allowed = await invoke<boolean>("plugin:android-installer|can_install");
      if (!allowed) throw new Error("install-permission");
    }

    await invoke("plugin:android-installer|install", { path: filePath });
  } catch (error) {
    // Last resort: let the browser download and install the APK.
    await openInBrowser(update.pageUrl);
    throw error;
  }
}
