import { useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  Smartphone,
  Square,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { ServerStatus, Settings } from "@/lib/tauri";

function codeGroups(code: string) {
  const clean = code.padEnd(6, "•").slice(0, 6);
  return [clean.slice(0, 3), clean.slice(3, 6)];
}

const rise = {
  hidden: { opacity: 0, y: 12 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.04 * index, type: "spring" as const, stiffness: 220, damping: 24 },
  }),
};

export function Dashboard({
  settings,
  status,
  busy,
  onToggleServer,
  onRegenerate,
  onForget,
  onClearDevices,
}: {
  settings: Settings;
  status: ServerStatus | null;
  busy: boolean;
  onToggleServer: () => void;
  onRegenerate: () => void;
  onForget: (id: string) => void;
  onClearDevices: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const pairingLink = status?.pairingLink ?? null;
  const running = status?.running ?? false;
  const groups = codeGroups(status?.pairingCode ?? "------");
  const saved = status?.savedDevices ?? [];

  async function copyCode() {
    if (!status?.pairingCode) return;
    try {
      await navigator.clipboard.writeText(status.pairingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <motion.div variants={rise} initial="hidden" animate="show" custom={0}>
          <Card className="relative h-full overflow-hidden bg-primary p-0 text-primary-foreground">
            <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-background/10" />

            <div className="relative flex flex-col items-center gap-6 p-7 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
                  Kod parowania
                </p>

                <div className="mt-4 flex items-center gap-2">
                  {groups.map((group, index) => (
                    <span key={index} className="flex gap-1.5">
                      {group.split("").map((character, characterIndex) => (
                        <span
                          key={characterIndex}
                          className="flex size-12 items-center justify-center rounded-2xl bg-background/15 text-2xl font-bold tabular-nums sm:size-14 sm:text-3xl"
                        >
                          {character}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/15 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-background/25"
                  >
                    {copied ? (
                      <Check className="size-4 shrink-0" />
                    ) : (
                      <Copy className="size-4 shrink-0" />
                    )}
                    {copied ? "Skopiowano" : "Kopiuj"}
                  </button>
                  <Button
                    size="sm"
                    onClick={onRegenerate}
                    className="bg-background text-foreground hover:bg-background/85"
                  >
                    <RefreshCw className="size-3.5" />
                    Nowy kod
                  </Button>
                </div>
              </div>

              {/* Plain white box, no clipping: every QR module stays scannable. */}
              <div className="shrink-0 rounded-2xl bg-white p-2.5">
                {pairingLink ? (
                  <QRCodeSVG
                    value={pairingLink}
                    size={152}
                    bgColor="#FFFFFF"
                    fgColor="#181D26"
                    level="M"
                    marginSize={2}
                  />
                ) : (
                  <div className="flex size-[152px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <WifiOff className="size-7" />
                    <span className="text-xs font-semibold">Wyłączone</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={rise} initial="hidden" animate="show" custom={1}>
          <Card className="flex h-full flex-col gap-4 p-6">
            <CardTitle>Połączenie</CardTitle>

            <Button
              variant={running ? "subtle" : "accent"}
              onClick={onToggleServer}
              disabled={busy}
              className="mt-auto w-full"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : running ? (
                <Square className="size-3.5" />
              ) : (
                <Play className="size-4" />
              )}
              {running ? "Zatrzymaj" : "Włącz"}
            </Button>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={rise} initial="hidden" animate="show" custom={2}>
        <Card className="gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Telefony</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{saved.length}</Badge>
              {saved.length > 1 && (
                <button
                  type="button"
                  onClick={onClearDevices}
                  className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:underline"
                >
                  Wyczyść
                </button>
              )}
            </div>
          </div>

          {saved.length ? (
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {saved.map((device) => (
                  <motion.div
                    key={device.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    className="flex items-center gap-3 rounded-2xl bg-secondary/15 px-3 py-2.5"
                  >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Smartphone className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {device.name}
                    </span>
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        device.connected
                          ? "bg-accent/15 text-accent"
                          : "text-muted-foreground"
                      }`}
                    >
                      {device.connected && (
                        <span className="size-1.5 rounded-full bg-accent" />
                      )}
                      {device.connected ? "Online" : "Zapisany"}
                    </span>
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
              {settings.rememberDevices
                ? "Brak zapisanych telefonów."
                : "Zapamiętywanie wyłączone."}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
