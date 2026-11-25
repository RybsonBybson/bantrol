const REPO = "RybsonBybson/bantrol";
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

export type Platform = "windows" | "macos" | "linux" | "android" | "unknown";

interface Asset {
  name: string;
  browser_download_url: string;
}

interface Release {
  tag_name?: string;
  name?: string;
  assets?: Asset[];
}

export interface DownloadTarget {
  platform: Platform;
  label: string;
  hint: string;
  url: string;
  version: string | null;
  fromRelease: boolean;
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  const platform =
    (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData?.platform?.toLowerCase() ?? "";

  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "unknown";
  if (/win/.test(platform) || /windows/.test(ua)) return "windows";
  if (/mac/.test(platform) || /mac os|macintosh/.test(ua)) return "macos";
  if (/linux|x11/.test(platform) || /linux/.test(ua)) return "linux";
  return "unknown";
}

function pickAsset(assets: Asset[], platform: Platform): Asset | null {
  const find = (pattern: RegExp) => assets.find((asset) => pattern.test(asset.name));

  switch (platform) {
    case "windows":
      return (
        find(/setup.*\.exe$/i) ??
        find(/\.exe$/i) ??
        find(/\.msi$/i) ??
        null
      );
    case "macos":
      return find(/\.dmg$/i) ?? find(/\.app\.tar\.gz$/i) ?? null;
    case "linux":
      return find(/\.appimage$/i) ?? find(/\.deb$/i) ?? null;
    case "android":
      return find(/\.apk$/i) ?? null;
    default:
      return (
        find(/setup.*\.exe$/i) ??
        find(/\.dmg$/i) ??
        find(/\.appimage$/i) ??
        null
      );
  }
}

function labels(platform: Platform) {
  switch (platform) {
    case "windows":
      return { label: "Pobierz dla Windows", hint: "Instalator dla Windows 10/11" };
    case "macos":
      return { label: "Pobierz dla macOS", hint: "Wersja dla komputerów Apple" };
    case "linux":
      return { label: "Pobierz dla Linux", hint: "Wersja dla Linux" };
    case "android":
      return { label: "Pobierz na Androida", hint: "Aplikacja na telefon" };
    default:
      return { label: "Pobierz Bantrol", hint: "Najnowsza wersja" };
  }
}

export function fallbackTarget(): DownloadTarget {
  const platform = detectPlatform();
  return {
    platform,
    ...labels(platform),
    url: RELEASES_PAGE,
    version: null,
    fromRelease: false,
  };
}

export async function resolveDownload(): Promise<DownloadTarget> {
  const platform = detectPlatform();
  const fallback = fallbackTarget();

  try {
    const response = await fetch(API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return fallback;

    const release = (await response.json()) as Release;
    const asset = pickAsset(release.assets ?? [], platform);
    const version = release.tag_name?.replace(/^v/i, "") ?? null;

    if (!asset) {
      return { ...fallback, version };
    }

    return {
      platform,
      ...labels(platform),
      url: asset.browser_download_url,
      version,
      fromRelease: true,
    };
  } catch {
    return fallback;
  }
}

export { RELEASES_PAGE };