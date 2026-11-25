import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, Settings2, X } from "lucide-react";

import { Brand } from "@/components/brand";
import { Sidebar, type View } from "@/components/sidebar";
import { StartupScreen } from "@/components/startup-screen";
import { StatusPill } from "@/components/status-pill";
import { Titlebar } from "@/components/titlebar";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/views/dashboard";
import { SettingsView } from "@/views/settings";
import { useResolvedTheme } from "@/hooks/use-theme";
import { useUpdater } from "@/hooks/use-updater";
import {
  getSettings,
  getStatus,
  isTauri,
  quitApp,
  regeneratePairingCode,
  saveSettings,
  startServer,
  stopServer,
  hideWindow as hideAppWindow,
  type ServerStatus,
  type Settings,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const updater = useUpdater();

  useResolvedTheme(settings?.theme ?? "system");

  useEffect(() => {
    settingsRef.current = settings;
    if (settings?.theme) {
      localStorage.setItem("bantrol.theme", settings.theme);
    }
  }, [settings]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [loadedSettings, loadedStatus] = await Promise.all([
          getSettings(),
          getStatus(),
        ]);
        if (!alive) return;
        settingsRef.current = loadedSettings;
        setSettings(loadedSettings);
        setStatus(loadedStatus);
      } catch {
        if (alive) {
          setError("Nie udało się wczytać ustawień. Spróbuj uruchomić Bantrola ponownie.");
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    import("@tauri-apps/plugin-autostart")
      .then((plugin) => plugin.isEnabled())
      .then((enabled) => {
        if (!alive) return;
        setSettings((current) =>
          current ? { ...current, autostart: enabled } : current,
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const next = await getStatus();
        setStatus(next);
      } catch {
        // A single failed poll should not disturb the UI.
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, []);

  async function updateSettings(patch: Partial<Settings>) {
    const current = settingsRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    settingsRef.current = next;
    setSettings(next);

    try {
      if (patch.autostart !== undefined && isTauri()) {
        const plugin = await import("@tauri-apps/plugin-autostart");
        if (patch.autostart) {
          await plugin.enable();
        } else {
          await plugin.disable();
        }
      }
      const nextStatus = await saveSettings(next);
      setStatus(nextStatus);
      setError(null);
    } catch {
      setError("Nie udało się zapisać zmian. Spróbuj ponownie.");
    }
  }

  async function toggleServer() {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const next = status.running ? await stopServer() : await startServer();
      setStatus(next);
    } catch {
      setError("Nie udało się zmienić stanu połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    try {
      setStatus(await getStatus());
      setError(null);
    } catch {
      setError("Nie udało się odświeżyć statusu.");
    }
  }

  async function regenerate() {
    try {
      const code = await regeneratePairingCode();
      setStatus((current) =>
        current
          ? { ...current, pairingCode: code }
          : current,
      );
      await refreshStatus();
    } catch {
      setError("Nie udało się wygenerować nowego kodu.");
    }
  }

  const updateInProgress =
    updater.phase === "checking" ||
    updater.phase === "downloading" ||
    updater.phase === "installing";

  if (!ready || !settings || updateInProgress) {
    return (
      <StartupScreen
        phase={updater.phase}
        progress={updater.progress}
        version={updater.version}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Titlebar running={status?.running ?? false} />

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <Sidebar
          view={view}
          onNavigate={setView}
          theme={settings.theme}
          onThemeChange={(theme) => updateSettings({ theme })}
          status={status}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 px-1 pb-5 pt-1">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Brand compact />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Bantrol · centrum sterowania
                </p>
                <h1 className="text-3xl font-bold tracking-tight">
                  {view === "dashboard" ? "Pulpit" : "Ustawienia"}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill running={status?.running ?? false} />
              <div className="flex gap-1 rounded-2xl bg-card p-1 md:hidden">
                <Button
                  variant={view === "dashboard" ? "default" : "ghost"}
                  size="iconSm"
                  aria-label="Pulpit"
                  onClick={() => setView("dashboard")}
                >
                  <LayoutDashboard className="size-4" />
                </Button>
                <Button
                  variant={view === "settings" ? "default" : "ghost"}
                  size="iconSm"
                  aria-label="Ustawienia"
                  onClick={() => setView("settings")}
                >
                  <Settings2 className="size-4" />
                </Button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-5 flex items-start gap-3 rounded-2xl bg-accent/15 px-4 py-3 text-sm font-semibold text-accent"
                >
                  <span className="min-w-0 flex-1 break-words">{error}</span>
                  <button
                    type="button"
                    aria-label="Zamknij komunikat"
                    onClick={() => setError(null)}
                    className={cn(
                      "rounded-full p-1 text-accent transition-colors hover:bg-accent/15",
                    )}
                  >
                    <X className="size-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {view === "dashboard" ? (
                  <Dashboard
                    settings={settings}
                    status={status}
                    busy={busy}
                    onToggleServer={toggleServer}
                    onRegenerate={regenerate}
                  />
                ) : (
                  <SettingsView
                    settings={settings}
                    onUpdate={updateSettings}
                    onHide={() => void hideAppWindow()}
                    onQuit={() => void quitApp()}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
