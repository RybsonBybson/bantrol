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

/**
 * Downloads the new APK and hands it to the system package installer. If
 * anything fails it falls back to downloading through the browser.
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
    const { openPath } = await import("@tauri-apps/plugin-opener");

    const response = await tauriFetch(update.url);
    if (!response.ok) throw new Error("download-failed");

    const total = Number(response.headers.get("content-length") ?? 0);
    const reader = response.body?.getReader?.();
    let bytes: Uint8Array;

    if (reader) {
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
      bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
    } else {
      bytes = new Uint8Array(await response.arrayBuffer());
    }

    onProgress(100);

    const fileName = `bantrol-${update.version}.apk`;
    await writeFile(fileName, bytes, { baseDir: BaseDirectory.AppCache });

    const dir = await appCacheDir();
    const filePath = await join(dir, fileName);
    await openPath(filePath);
  } catch {
    await openInBrowser(update.url);
  }
}
