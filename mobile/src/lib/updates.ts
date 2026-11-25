import { isTauri } from "@/lib/pairing";

const API = "https://api.github.com/repos/RybsonBybson/bantrol/releases/latest";

export interface MobileUpdate {
  version: string;
  url: string;
}

function compareVersions(a: string, b: string) {
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
      url:
        apk?.browser_download_url ??
        release.html_url ??
        "https://github.com/RybsonBybson/bantrol/releases/latest",
    };
  } catch {
    return null;
  }
}

export async function openUpdate(url: string) {
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
