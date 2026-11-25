import { useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  MonitorSmartphone,
  MousePointer2,
  Play,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Square,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import type { ServerStatus, Settings } from "@/lib/tauri";

function codeGroups(code: string) {
  const clean = code.padEnd(6, "•").slice(0, 6);
  return [clean.slice(0, 3), clean.slice(3, 6)];
}

const steps = [
  {
    icon: MonitorSmartphone,
    title: "Otwórz Bantrol na telefonie",
    text: "Aplikacja na telefonie łączy się z komputerem w kilka sekund — bez kabli i bez konfiguracji.",
  },
  {
    icon: ScanLine,
    title: "Zeskanuj kod QR",
    text: "Skieruj telefon na kod obok. Bantrol sam odczyta dane i połączy oba urządzenia.",
  },
  {
    icon: MousePointer2,
    title: "Przejmij sterowanie",
    text: "Podgląd ekranu, kursor, kliknięcia, przewijanie i klawiatura — wszystko w zasięgu kciuka.",
  },
];

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 * index, type: "spring" as const, stiffness: 220, damping: 24 },
  }),
};

export function Dashboard({
  settings,
  status,
  busy,
  onToggleServer,
  onRegenerate,
}: {
  settings: Settings;
  status: ServerStatus | null;
  busy: boolean;
  onToggleServer: () => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const pairingLink = status?.pairingLink ?? null;
  const running = status?.running ?? false;
  const groups = codeGroups(status?.pairingCode ?? "------");

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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <motion.div variants={rise} initial="hidden" animate="show" custom={0}>
          <Card className="relative h-full overflow-hidden bg-primary p-0 text-primary-foreground">
            <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-background/10" />
            <div className="pointer-events-none absolute -bottom-28 left-1/3 size-56 rounded-full bg-background/5" />

            <div className="relative flex flex-col gap-8 p-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-md">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                  <ShieldCheck className="size-3.5" />
                  Kod parowania
                </div>

                <div className="mt-4 flex items-center gap-3">
                  {groups.map((group, index) => (
                    <span key={index} className="flex gap-1.5">
                      {group.split("").map((character, characterIndex) => (
                        <motion.span
                          key={characterIndex}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 + characterIndex * 0.03 }}
                          className="flex size-12 items-center justify-center rounded-2xl bg-background/15 text-2xl font-bold tabular-nums sm:size-14 sm:text-3xl"
                        >
                          {character}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-sm leading-relaxed opacity-80">
                  Zeskanuj kod QR aplikacją Bantrol na telefonie albo wpisz kod
                  ręcznie. Kod jest ważny do momentu wygenerowania nowego.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
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
                    <span className="truncate">
                      {copied ? "Skopiowano kod" : "Kopiuj kod"}
                    </span>
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

              <div className="shrink-0 self-start rounded-3xl bg-card p-3 lg:self-center">
                {pairingLink ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 240, damping: 24 }}
                    className="overflow-hidden rounded-2xl"
                  >
                    <QRCodeSVG
                      value={pairingLink}
                      size={152}
                      bgColor="#F3FDFE"
                      fgColor="#181D26"
                      level="M"
                    />
                  </motion.div>
                ) : (
                  <div className="flex size-[152px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <WifiOff className="size-8" />
                    <span className="text-xs font-semibold">
                      Włącz połączenie,
                      <br />
                      aby pokazać QR
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="flex flex-col gap-5">
          <motion.div variants={rise} initial="hidden" animate="show" custom={1}>
            <Card className="gap-5 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Połączenie</CardTitle>
                  <CardDescription className="mt-1">
                    Twój telefon i komputer, tylko dla siebie
                  </CardDescription>
                </div>
                <StatusPill running={running} />
              </div>

              <p className="rounded-2xl bg-secondary/15 p-4 text-sm leading-relaxed text-muted-foreground">
                {running
                  ? "Bantrol jest gotowy. Otwórz aplikację na telefonie i zeskanuj kod QR."
                  : "Włącz połączenie, aby telefon mógł zobaczyć ekran i przejąć sterowanie."}
              </p>

              <Button
                variant={running ? "subtle" : "accent"}
                onClick={onToggleServer}
                disabled={busy}
                className="w-full"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : running ? (
                  <Square className="size-3.5" />
                ) : (
                  <Play className="size-4" />
                )}
                {running ? "Zatrzymaj połączenie" : "Włącz połączenie"}
              </Button>
            </Card>
          </motion.div>

          <motion.div variants={rise} initial="hidden" animate="show" custom={2}>
            <Card className="gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Połączone telefony</CardTitle>
                <Badge variant="secondary">{status?.clients ?? 0}</Badge>
              </div>

              {status?.devices?.length ? (
                <div className="flex flex-col gap-2">
                  {status.devices.map((device, index) => (
                    <motion.div
                      key={`${device}-${index}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 rounded-2xl bg-secondary/15 px-3 py-2.5"
                    >
                      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <Smartphone className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {device}
                      </span>
                      <span className="size-2 rounded-full bg-accent" />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-secondary/15 p-4">
                  <p className="text-sm font-semibold">Cisza w eterze</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Zeskanuj kod QR aplikacją Bantrol na telefonie, aby zobaczyć
                    podgląd i przejąć sterowanie.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <QrCode className="size-3.5" />
                {settings.requirePairing
                  ? "Parowanie kodem jest włączone"
                  : "Parowanie kodem jest wyłączone"}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.title}
              variants={rise}
              initial="hidden"
              animate="show"
              custom={3 + index}
            >
              <Card className="h-full gap-4 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary/25 text-foreground">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-secondary">
                    0{index + 1}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                  <CardDescription className="mt-1.5">
                    {step.text}
                  </CardDescription>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="px-2 text-xs leading-relaxed text-muted-foreground"
      >
        Twój ekran i dane zostają wyłącznie między komputerem a telefonem.
        Bantrol nie wysyła ich do chmury.
      </motion.p>
    </div>
  );
}
