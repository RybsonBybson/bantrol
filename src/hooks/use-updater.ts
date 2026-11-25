import { useEffect, useState } from "react";

import { isTauri } from "@/lib/tauri";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "installing"
  | "ready";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error("update-timeout")), ms),
    ),
  ]);
}

/**
 * On launch Bantrol asks GitHub for a newer build, downloads it and restarts
 * into it. Any problem (offline, no release, unsigned build) is non-fatal and
 * simply leaves the app running.
 */
export function useUpdater() {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      setPhase("ready");
      return;
    }

    let cancelled = false;

    (async () => {
      setPhase("checking");
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await withTimeout(check(), 15000);
        if (cancelled) return;

        if (!update) {
          setPhase("ready");
          return;
        }

        setVersion(update.version);
        setPhase("downloading");

        let total = 0;
        let downloaded = 0;

        await withTimeout(
          update.downloadAndInstall((event) => {
            if (cancelled) return;
            if (event.event === "Started") {
              total = event.data.contentLength ?? 0;
              setProgress(total ? 2 : 8);
            } else if (event.event === "Progress") {
              downloaded += event.data.chunkLength;
              if (total > 0) {
                setProgress(Math.min(99, Math.round((downloaded / total) * 100)));
              }
            } else if (event.event === "Finished") {
              setProgress(100);
              setPhase("installing");
            }
          }),
          10 * 60 * 1000,
        );

        if (cancelled) return;
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch {
        // Offline, no release yet or an unsigned build: keep the app usable.
        if (!cancelled) setPhase("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { phase, progress, version };
}
