import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, Settings2, Smartphone, X } from "lucide-react";

import { Brand } from "@/components/brand";
import { Sidebar, type View } from "@/components/sidebar";
import { StartupScreen } from "@/components/startup-screen";
import { Titlebar } from "@/components/titlebar";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/views/dashboard";
import { PhonesView } from "@/views/phones";
import { SettingsView } from "@/views/settings";
import { useResolvedTheme } from "@/hooks/use-theme";
import { useUpdater } from "@/hooks/use-updater";
import {
  clearSavedDevices,
  forgetDevice as forgetDeviceApi,
  getAppVersion,
  getSettings,
  getStatus,
  isTauri,
  openPhoneWindow,
  refreshWol,
  regeneratePairingCode,
  saveSettings,
  startServer,
  stopServer,
  type SavedDevice,
  type ServerStatus,
  type Settings,
} from "@/lib/tauri";

const TITLES: Record<View, string> = {
  dashboard: "Pulpit",
  phones: "Telefony",
  settings: "Ustawienia",
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState("");
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
        const [loadedSettings, loadedStatus, appVersion] = await Promise.all([
          getSettings(),
          getStatus(),
          getAppVersion(),
        ]);
        if (!alive) return;
        settingsRef.current = loadedSettings;
        setSettings(loadedSettings);
        setStatus(loadedStatus);
        setVersion(appVersion);
      } catch {
        if (alive) setError("Nie udało się wczytać danych.");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        setStatus(await getStatus());
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
      if (patch.autostartMode !== undefined && isTauri()) {
        const plugin = await import("@tauri-apps/plugin-autostart");
        if (patch.autostartMode === "off") {
          await plugin.disable();
        } else {
          await plugin.enable();
        }
      }
      const nextStatus = await saveSettings(next);
      setStatus(nextStatus);
      setError(null);
    } catch {
      setError("Nie udało się zapisać zmian.");
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
      setError("Nie udało się zmienić stanu połączenia.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    try {
      const code = await regeneratePairingCode();
      setStatus((current) => (current ? { ...current, pairingCode: code } : current));
      setStatus(await getStatus());
    } catch {
      setError("Nie udało się wygenerować nowego kodu.");
    }
  }

  async function forgetDevice(id: string) {
    try {
      setStatus(await forgetDeviceApi(id));
    } catch {
      setError("Nie udało się zapomnieć telefonu.");
    }
  }

  async function clearDevices() {
    try {
      setStatus(await clearSavedDevices());
    } catch {
      setError("Nie udało się wyczyścić listy.");
    }
  }

  async function recheckWol() {
    try {
      setStatus(await refreshWol());
    } catch {
      setError("Nie udało się sprawdzić Wake-on-LAN.");
    }
  }

  function openPhone(device: SavedDevice) {
    if (!isTauri()) return;
    void openPhoneWindow(device.id).catch(() =>
      setError("Nie udało się otworzyć okna telefonu."),
    );
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
      <Titlebar running={status?.running ?? false} version={version} />

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <Sidebar
          view={view}
          onNavigate={setView}
          theme={settings.theme}
          onThemeChange={(theme) => updateSettings({ theme })}
          version={version}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 px-1 pb-5 pt-1">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <Brand compact />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                {TITLES[view]}
              </h1>
            </div>

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
                variant={view === "phones" ? "default" : "ghost"}
                size="iconSm"
                aria-label="Telefony"
                onClick={() => setView("phones")}
              >
                <Smartphone className="size-4" />
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
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-5 flex items-center gap-3 rounded-2xl bg-accent/15 px-4 py-3 text-sm font-semibold text-accent"
                >
                  <span className="min-w-0 flex-1">{error}</span>
                  <button
                    type="button"
                    aria-label="Zamknij"
                    onClick={() => setError(null)}
                    className="rounded-full p-1 transition-colors hover:bg-accent/15"
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
                {view === "dashboard" && (
                  <Dashboard
                    status={status}
                    busy={busy}
                    onToggleServer={toggleServer}
                    onRegenerate={regenerate}
                  />
                )}
                {view === "phones" && (
                  <PhonesView
                    status={status}
                    onOpen={openPhone}
                    onForget={forgetDevice}
                    onClear={clearDevices}
                  />
                )}
                {view === "settings" && (
                  <SettingsView
                    settings={settings}
                    onUpdate={updateSettings}
                    wol={
                      status?.wol ?? {
                        supported: false,
                        enabled: false,
                        mac: null,
                        broadcast: null,
                      }
                    }
                    onRefreshWol={() => void recheckWol()}
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
