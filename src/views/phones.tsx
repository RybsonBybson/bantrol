import { AnimatePresence, motion } from "framer-motion";
import { MonitorSmartphone, Play, Smartphone, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import type { SavedDevice, ServerStatus } from "@/lib/tauri";

function lastSeenLabel(value: number) {
  if (!value) return "Nowy";
  const date = new Date(value * 1000);
  return `Ostatnio ${date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  })}`;
}

export function PhonesView({
  status,
  onOpen,
  onForget,
  onClear,
}: {
  status: ServerStatus | null;
  onOpen: (device: SavedDevice) => void;
  onForget: (id: string) => void;
  onClear: () => void;
}) {
  const devices = status?.savedDevices ?? [];
  const online = devices.filter((device) => device.connected).length;

  return (
    <div className="flex flex-col gap-5">
      <Card className="gap-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary/20">
              <MonitorSmartphone className="size-4.5" />
            </span>
            <div>
              <CardTitle>Telefony</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {online
                  ? `${online} online`
                  : "Steruj telefonem z tego okna."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{devices.length}</Badge>
            {devices.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:underline"
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>

        {devices.length ? (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {devices.map((device) => (
                <motion.div
                  key={device.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="flex items-center gap-3 rounded-2xl bg-secondary/15 px-3 py-2.5"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                      device.connected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/25 text-muted-foreground"
                    }`}
                  >
                    <Smartphone className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {device.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className={`size-1.5 rounded-full ${
                          device.connected ? "bg-accent" : "bg-muted-foreground/40"
                        }`}
                      />
                      {device.connected ? "Online" : lastSeenLabel(device.lastSeen)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpen(device)}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Play className="size-3.5" />
                    Steruj
                  </button>

                  <button
                    type="button"
                    aria-label={`Zapomnij ${device.name}`}
                    title="Zapomnij"
                    onClick={() => onForget(device.id)}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent/15 hover:text-accent"
                  >
                    <X className="size-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-secondary/15 p-4 text-sm text-muted-foreground">
            <Trash2 className="size-4 shrink-0" />
            Brak zapisanych telefonów. Połącz telefon kodem z Pulpitu.
          </div>
        )}
      </Card>
    </div>
  );
}
