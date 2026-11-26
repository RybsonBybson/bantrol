import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Play,
  RefreshCw,
  Square,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { ServerStatus } from "@/lib/tauri";

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
  status,
  busy,
  onToggleServer,
  onRegenerate,
}: {
  status: ServerStatus | null;
  busy: boolean;
  onToggleServer: () => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const pairingLink = status?.pairingLink ?? null;
  const running = status?.running ?? false;
  const groups = codeGroups(status?.pairingCode ?? "------");

  // Pairing secrets hide again on their own, so an unattended screen stays safe.
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

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
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
                    Kod parowania
                  </p>
                  <button
                    type="button"
                    onClick={() => setRevealed((value) => !value)}
                    aria-label={revealed ? "Ukryj kod" : "Pokaż kod"}
                    title={revealed ? "Ukryj" : "Pokaż"}
                    className="flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-background/25"
                  >
                    {revealed ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                    {revealed ? "Ukryj" : "Pokaż"}
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {groups.map((group, index) => (
                    <span key={index} className="flex gap-1.5">
                      {group.split("").map((character, characterIndex) => (
                        <span
                          key={characterIndex}
                          className={`flex size-12 items-center justify-center rounded-2xl bg-background/15 text-2xl font-bold tabular-nums transition-[filter] duration-300 sm:size-14 sm:text-3xl ${
                            revealed ? "" : "select-none blur-[7px]"
                          }`}
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
              <div className="relative shrink-0 rounded-2xl bg-white p-2.5">
                {pairingLink ? (
                  <QRCodeSVG
                    value={pairingLink}
                    size={152}
                    bgColor="#FFFFFF"
                    fgColor="#181D26"
                    level="M"
                    marginSize={2}
                    className={`transition-[filter] duration-300 ${
                      revealed ? "" : "blur-[7px]"
                    }`}
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
    </div>
  );
}
