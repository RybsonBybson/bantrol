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
import { QRCodeSVG } from "qrcode.react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
    title: "Otwórz Bantrol",
    text: "Serwer startuje razem z aplikacją. Port i jakość streamu dopasujesz w ustawieniach.",
  },
  {
    icon: ScanLine,
    title: "Zeskanuj lub wpisz adres",
    text: "Telefon musi być w tej samej sieci Wi-Fi. Adres i kod parowania widzisz obok.",
  },
  {
    icon: MousePointer2,
    title: "Przejmij sterowanie",
    text: "Podgląd ekranu, kursor, kliknięcia, scroll i klawiatura — wszystko z przeglądarki telefonu.",
  },
];

export function Dashboard({
  settings,
  status,
  busy,
  onToggleServer,
  onRegenerate,
  onRefresh,
}: {
  settings: Settings;
  status: ServerStatus | null;
  busy: boolean;
  onToggleServer: () => void;
  onRegenerate: () => void;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = status?.url ?? null;
  const running = status?.running ?? false;
  const groups = codeGroups(status?.pairingCode ?? "------");

  async function copyAddress() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden bg-primary p-0 text-primary-foreground">
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

              <p className="mt-4 text-sm leading-relaxed opacity-80">
                Wpisz ten kod w pilocie na telefonie. Kod jest ważny do
                momentu wygenerowania nowego.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyAddress}
                  className="flex min-w-0 items-center gap-2 rounded-2xl bg-background/15 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-background/25"
                >
                  {copied ? (
                    <Check className="size-4 shrink-0" />
                  ) : (
                    <Copy className="size-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {copied ? "Skopiowano adres" : (url ?? "Serwer zatrzymany")}
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
              {url ? (
                <div className="overflow-hidden rounded-2xl">
                  <QRCodeSVG
                    value={url}
                    size={152}
                    bgColor="#F3FDFE"
                    fgColor="#181D26"
                    level="M"
                  />
                </div>
              ) : (
                <div className="flex size-[152px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <WifiOff className="size-8" />
                  <span className="text-xs font-semibold">
                    Uruchom serwer,
                    <br />
                    aby pokazać QR
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="gap-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Serwer i stream</CardTitle>
                <CardDescription className="mt-1">
                  Lokalny dostęp przez Wi-Fi
                </CardDescription>
              </div>
              <StatusPill running={running} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-secondary/15 p-3">
                <p className="text-xs text-muted-foreground">Port</p>
                <p className="mt-1 font-bold tabular-nums">
                  {status?.port ?? settings.port}
                </p>
              </div>
              <div className="rounded-2xl bg-secondary/15 p-3">
                <p className="text-xs text-muted-foreground">Klatki</p>
                <p className="mt-1 font-bold tabular-nums">
                  {settings.streamFps} fps
                </p>
              </div>
              <div className="rounded-2xl bg-secondary/15 p-3">
                <p className="text-xs text-muted-foreground">Szerokość</p>
                <p className="mt-1 font-bold tabular-nums">
                  {settings.streamWidth} px
                </p>
              </div>
              <div className="rounded-2xl bg-secondary/15 p-3">
                <p className="text-xs text-muted-foreground">Jakość</p>
                <p className="mt-1 font-bold tabular-nums">
                  {settings.jpegQuality}%
                </p>
              </div>
            </div>

            {status?.lastError && (
              <p className="rounded-2xl bg-accent/15 p-3 text-xs font-semibold text-accent">
                {status.lastError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant={running ? "subtle" : "accent"}
                onClick={onToggleServer}
                disabled={busy}
                className="flex-1"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : running ? (
                  <Square className="size-3.5" />
                ) : (
                  <Play className="size-4" />
                )}
                {running ? "Zatrzymaj serwer" : "Uruchom serwer"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                aria-label="Odśwież status"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </Card>

          <Card className="gap-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Połączone urządzenia</CardTitle>
              <Badge variant="secondary">{status?.clients ?? 0}</Badge>
            </div>

            {status?.devices?.length ? (
              <div className="flex flex-col gap-2">
                {status.devices.map((device, index) => (
                  <div
                    key={`${device}-${index}`}
                    className="flex items-center gap-3 rounded-2xl bg-secondary/15 px-3 py-2.5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Smartphone className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {device}
                    </span>
                    <span className="size-2 rounded-full bg-accent" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-secondary/15 p-4">
                <p className="text-sm font-semibold">Cisza w eterze</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Otwórz adres {status?.url ?? "serwera"} na telefonie, aby
                  zobaczyć podgląd i przejąć sterowanie.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <QrCode className="size-3.5" />
              {settings.requirePairing
                ? "Parowanie kodem jest wymagane"
                : "Parowanie kodem jest wyłączone"}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card key={step.title} className="gap-4 p-6">
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
          );
        })}
      </div>

      <CardContent className="p-0">
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">
          Podgląd ekranu i sterowanie działają wyłącznie w Twojej sieci
          lokalnej. Bantrol nie wysyła obrazu ani danych poza urządzenia w
          Wi-Fi.
        </p>
      </CardContent>
    </div>
  );
}
