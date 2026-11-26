import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CameraOff,
  Check,
  ChevronDown,
  Download,
  Keyboard,
  Loader2,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  MousePointerClick,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { RemoteConnection, type ReadyInfo } from "@/lib/connection";
import {
  deviceId,
  discoverComputers,
  forgetLastComputer,
  isTauri,
  loadLastComputer,
  parsePairingLink,
  saveLastComputer,
  updateLastComputerToken,
  type PairInfo,
} from "@/lib/pairing";
import {
  checkMobileUpdate,
  downloadAndInstall,
  type MobileUpdate,
} from "@/lib/updates";

const APP_VERSION = "0.1.0";
const DEMO = !isTauri();

type ThemeMode = "system" | "light" | "dark";
type Screen = "boot" | "pair" | "connecting" | "remote";
type UpdateState = "idle" | "downloading" | "installing";

interface Point {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function phoneName() {
  try {
    const stored = localStorage.getItem("bantrol.mobile.name");
    if (stored) return stored;
    const name = `Telefon ${Math.floor(10 + Math.random() * 90)}`;
    localStorage.setItem("bantrol.mobile.name", name);
    return name;
  } catch {
    return "Telefon";
  }
}

function useMobileTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem("bantrol.mobile.theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        return stored;
      }
    } catch {
      // Fall through to system.
    }
    return "system";
  });
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const dark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("bantrol.mobile.theme", theme);
    } catch {
      // Ignore storage failures.
    }
  }, [dark, theme]);

  return { theme, dark, setTheme };
}

function Select({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
  className?: string;
}) {
  return (
    <label className={`relative flex items-center ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-2xl bg-secondary/20 pl-3 pr-8 text-xs font-semibold text-foreground outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" />
    </label>
  );
}

function ThemeToggle({
  theme,
  onChange,
  className = "",
}: {
  theme: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  className?: string;
}) {
  return (
    <Select
      label="Jasność"
      value={theme}
      onChange={(value) => onChange(value as ThemeMode)}
      options={[
        { value: "light", label: "Jasny" },
        { value: "dark", label: "Ciemny" },
        { value: "system", label: "System" },
      ]}
      className={className}
    />
  );
}

function Logo({ className = "size-12" }: { className?: string }) {
  return <img src="/bantrol-logo.svg" alt="Logo Bantrol" className={className} />;
}

function BootScreen() {
  return (
    <motion.div
      key="boot"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-center gap-7 px-8 safe-top safe-bottom"
    >
      <div className="relative flex size-28 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-[2.25rem] bg-secondary/25"
          animate={{ scale: [1, 1.09, 1], opacity: [0.7, 0.3, 0.7] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
        >
          <Logo className="size-20" />
        </motion.div>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold tracking-tight">Bantrol</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sprawdzamy, czy wszystko gotowe…
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="size-2 rounded-full bg-accent"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: index * 0.16,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function ConnectingScreen({
  computer,
  onCancel,
}: {
  computer: PairInfo;
  onCancel: () => void;
}) {
  return (
    <motion.div
      key="connecting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-center gap-8 px-8 safe-top safe-bottom"
    >
      <div className="relative flex size-32 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/15"
          animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.9, 0.3, 0.9] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute inset-4 rounded-full bg-primary/20"
          animate={{ scale: [1, 0.9, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <Logo className="relative size-16" />
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold tracking-tight">
          Łączymy z komputerem
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {computer.name}. To potrwa tylko chwilę.
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-2xl bg-card px-5 py-3 text-sm font-semibold"
      >
        Anuluj
      </button>
    </motion.div>
  );
}

/**
 * Camera preview with a clear reticle. The native scanner is only a fallback,
 * because it cannot draw framing corners inside its own preview.
 */
function ScannerOverlay({
  onResult,
  onClose,
  onFallback,
}: {
  onResult: (raw: string) => void;
  onClose: () => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (stopped) return;
        setReady(true);

        const { default: jsQR } = await import("jsqr");
        const tick = () => {
          if (stopped) return;
          if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth) {
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context?.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            if (image) {
              const code = jsQR(image.data, image.width, image.height, {
                inversionAttempts: "dontInvert",
              });
              if (code?.data) {
                stopped = true;
                resultRef.current(code.data);
                return;
              }
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch {
        if (!stopped) {
          setReady(false);
          setFailed(true);
        }
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="h-full w-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-8 px-8 safe-top safe-bottom">
        <div className="relative aspect-square w-[74vw] max-w-[320px]">
          <div className="absolute inset-0 rounded-[2rem] shadow-[0_0_0_9999px_rgba(10,13,18,0.62)]" />
          <span className="absolute left-0 top-0 size-11 rounded-tl-[2rem] border-l-4 border-t-4 border-[#ee6c4d]" />
          <span className="absolute right-0 top-0 size-11 rounded-tr-[2rem] border-r-4 border-t-4 border-[#ee6c4d]" />
          <span className="absolute bottom-0 left-0 size-11 rounded-bl-[2rem] border-b-4 border-l-4 border-[#ee6c4d]" />
          <span className="absolute bottom-0 right-0 size-11 rounded-br-[2rem] border-b-4 border-r-4 border-[#ee6c4d]" />
          {ready && (
            <motion.span
              className="absolute inset-x-3 h-0.5 rounded-full bg-[#e0fbfc]/80"
              initial={{ top: "12%", opacity: 0.2 }}
              animate={{ top: ["12%", "88%", "12%"], opacity: [0.2, 0.9, 0.2] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
        <p className="rounded-full bg-black/45 px-4 py-2 text-center text-sm font-semibold text-[#e0fbfc]">
          Skieruj kamerę na kod QR na komputerze
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Zamknij skaner"
        className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-2xl bg-black/50 text-[#e0fbfc] safe-top"
      >
        <X className="size-5" />
      </button>

      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-[#98c1d9]" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-10 text-center">
          <CameraOff className="size-10 text-[#98c1d9]" />
          <p className="text-sm font-semibold text-[#e0fbfc]">
            Nie udało się włączyć aparatu. Sprawdź uprawnienia.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onFallback}
              className="rounded-2xl bg-[#ee6c4d] px-4 py-2.5 text-sm font-bold text-[#e0fbfc]"
            >
              Skaner systemowy
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#212833] px-4 py-2.5 text-sm font-bold text-[#e0fbfc]"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function PairScreen({
  computer,
  update,
  updateState,
  updateProgress,
  error,
  scanning,
  finding,
  manualCode,
  theme,
  version,
  onThemeChange,
  onScan,
  onManualCodeChange,
  onManualSubmit,
  onInstallUpdate,
  onReconnect,
  onForget,
  onDismissError,
  onDemo,
}: {
  computer: PairInfo | null;
  update: MobileUpdate | null;
  updateState: UpdateState;
  updateProgress: number;
  error: string | null;
  scanning: boolean;
  finding: boolean;
  manualCode: string;
  theme: ThemeMode;
  version: string;
  onThemeChange: (mode: ThemeMode) => void;
  onScan: () => void;
  onManualCodeChange: (value: string) => void;
  onManualSubmit: () => void;
  onInstallUpdate: () => void;
  onReconnect: () => void;
  onForget: () => void;
  onDismissError: () => void;
  onDemo: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      key="pair"
      initial={reduce ? undefined : { opacity: 0, y: 12 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex h-full flex-col overflow-y-auto px-5 safe-top safe-bottom"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo className="size-9" />
            <span className="text-lg font-bold tracking-tight">Bantrol</span>
          </div>
          <ThemeToggle
            theme={theme}
            onChange={onThemeChange}
            className="w-[148px]"
          />
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 py-10 landscape:grid landscape:grid-cols-[1.05fr_0.95fr] landscape:items-center landscape:gap-8 landscape:py-6">
          <div>
            <motion.div
              initial={reduce ? undefined : { opacity: 0, scale: 0.92 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 180, damping: 20 }}
              className="relative mx-auto flex size-44 items-center justify-center rounded-[2.5rem] bg-card landscape:size-36"
            >
              <span className="absolute inset-5 rounded-[2rem] bg-secondary/20" />
              <motion.span
                className="absolute inset-8 rounded-full bg-primary/10"
                animate={
                  reduce
                    ? undefined
                    : { scale: [0.9, 1.08, 0.9], opacity: [0.7, 0.25, 0.7] }
                }
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative flex flex-col items-center gap-2">
                <Smartphone className="size-14 text-primary" />
                <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground">
                  <Wifi className="size-3" />
                  Gotowy
                </span>
              </div>
            </motion.div>

            <div className="mt-7 text-center landscape:text-left">
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                Twój komputer
                <br />
                pod ręką.
              </h1>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground landscape:mx-0">
                Zeskanuj kod QR z ekranu komputera albo wpisz kod parowania.
                Bez kabli, kont i chmury.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start gap-3 rounded-2xl bg-accent/15 px-4 py-3 text-sm font-semibold text-accent"
                >
                  <span className="min-w-0 flex-1">{error}</span>
                  <button
                    type="button"
                    aria-label="Zamknij komunikat"
                    onClick={onDismissError}
                  >
                    <X className="size-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {update && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  {updateState === "idle" ? (
                    <Download className="size-5" />
                  ) : (
                    <Loader2 className="size-5 animate-spin" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Nowa wersja {update.version}</p>
                  <p className="text-xs text-muted-foreground">
                    {updateState === "downloading"
                      ? `Pobieranie… ${updateProgress}%`
                      : updateState === "installing"
                        ? "Uruchamiam instalator…"
                        : "Pobierz i zainstaluj najnowszą wersję."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onInstallUpdate}
                  disabled={updateState !== "idle"}
                  className="shrink-0 rounded-xl bg-card px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Zaktualizuj
                </button>
              </motion.div>
            )}

            <motion.button
              type="button"
              onClick={onScan}
              disabled={scanning}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-3 rounded-3xl bg-accent px-5 py-5 text-base font-bold text-accent-foreground disabled:opacity-70"
            >
              {scanning ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <QrCode className="size-5" />
              )}
              {scanning ? "Otwieramy aparat…" : "Zeskanuj kod QR"}
            </motion.button>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                onManualSubmit();
              }}
              className="rounded-3xl bg-card p-4"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Keyboard className="size-3.5" />
                Wpisz kod z komputera
              </div>
              <input
                value={manualCode}
                onChange={(event) =>
                  onManualCodeChange(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Kod parowania"
                disabled={finding}
                className="mt-3 h-14 w-full rounded-2xl bg-secondary/20 px-4 text-center text-xl font-bold tracking-[0.5em] tabular-nums outline-none placeholder:tracking-[0.5em] placeholder:text-muted-foreground/50 disabled:opacity-60"
              />
              <div className="mt-2 flex h-5 items-center justify-center gap-2 text-[11px] text-muted-foreground">
                {finding ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Szukamy komputera…
                  </>
                ) : (
                  "Połączymy automatycznie po wpisaniu 6 cyfr."
                )}
              </div>
            </form>

            {computer && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/25">
                    <Monitor className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Ostatni komputer
                    </p>
                    <p className="truncate text-sm font-bold">{computer.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onForget}
                    className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Zapomnij
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onReconnect}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
                >
                  <RefreshCw className="size-4" />
                  Połącz ponownie
                </button>
              </motion.div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Check className="size-3.5" />
              Tylko Twoje urządzenia
              <span className="mx-1 opacity-40">·</span>
              Bez konta
            </div>

            {DEMO && (
              <button
                type="button"
                onClick={onDemo}
                className="mx-auto text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:underline"
              >
                Podgląd interfejsu
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pb-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ScanLine className="size-3.5" />
            Skaner działa tylko w aplikacji
          </span>
          <span>wersja {version}</span>
        </div>
      </div>
    </motion.div>
  );
}

function DemoScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-[#212833] p-3">
        <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-[#e0fbfc] p-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#ee6c4d]" />
            <span className="size-2 rounded-full bg-[#98c1d9]" />
            <span className="size-2 rounded-full bg-[#3d5a80]/50" />
            <span className="ml-2 h-2 w-24 rounded-full bg-[#98c1d9]/50" />
          </div>
          <div className="mt-4 grid h-[calc(100%-1.75rem)] grid-cols-[0.9fr_1.1fr] gap-3">
            <div className="rounded-xl bg-[#3d5a80] p-3">
              <div className="h-2 w-10 rounded-full bg-[#e0fbfc]/50" />
              <div className="mt-2 h-2 w-14 rounded-full bg-[#e0fbfc]/25" />
              <div className="mt-4 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#e0fbfc]/20" />
                <div className="h-1.5 w-4/5 rounded-full bg-[#e0fbfc]/20" />
                <div className="h-1.5 w-2/3 rounded-full bg-[#e0fbfc]/20" />
              </div>
              <div className="mt-4 h-6 w-16 rounded-lg bg-[#ee6c4d]" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex-1 rounded-xl bg-[#98c1d9]/35 p-3">
                <div className="h-2 w-16 rounded-full bg-[#3d5a80]/40" />
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <div className="h-8 rounded-lg bg-[#f3fdfe]" />
                  <div className="h-8 rounded-lg bg-[#f3fdfe]" />
                  <div className="h-8 rounded-lg bg-[#f3fdfe]" />
                </div>
              </div>
              <div className="h-10 rounded-xl bg-[#98c1d9]/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoteScreen({
  ready,
  computer,
  frameUrl,
  demo,
  inputEnabled,
  showKeyboard,
  draft,
  fullscreenOn,
  onDraftChange,
  onSendEnter,
  onToggleKeyboard,
  onDisconnect,
  onFullscreen,
  onMove,
  onClick,
  onRightClick,
  onScroll,
  onKey,
  frameSize,
  onFrameSize,
}: {
  ready: ReadyInfo | null;
  computer: PairInfo | null;
  frameUrl: string | null;
  demo: boolean;
  inputEnabled: boolean;
  showKeyboard: boolean;
  draft: string;
  fullscreenOn: boolean;
  onDraftChange: (value: string) => void;
  onSendEnter: () => void;
  onToggleKeyboard: () => void;
  onDisconnect: () => void;
  onFullscreen: () => void;
  onMove: (x: number, y: number) => void;
  onClick: (x: number, y: number) => void;
  onRightClick: (x: number, y: number) => void;
  onScroll: (dx: number, dy: number) => void;
  onKey: (key: string) => void;
  frameSize: { width: number; height: number } | null;
  onFrameSize: (size: { width: number; height: number }) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const [padSize, setPadSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<Point>({ x: 0.5, y: 0.5 });
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({
    mode: "none" as "none" | "cursor" | "pan",
    startCount: 0,
    startX: 0,
    startY: 0,
    startTime: 0,
    moved: false,
    startDist: 0,
    startZoom: 1,
    lastMidX: 0,
    lastMidY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const scrollAcc = useRef<Point>({ x: 0, y: 0 });

  const natural = frameSize ?? { width: 16, height: 10 };
  const display = useMemo(() => {
    if (!padSize.width || !padSize.height) return { width: 0, height: 0 };
    const scale = Math.min(
      padSize.width / natural.width,
      padSize.height / natural.height,
    );
    return {
      width: Math.max(natural.width * scale, 1),
      height: Math.max(natural.height * scale, 1),
    };
  }, [natural.width, natural.height, padSize.width, padSize.height]);
  const displayRef = useRef(display);
  displayRef.current = display;

  useEffect(() => {
    const element = padRef.current;
    if (!element) return;
    const update = () =>
      setPadSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function pushCursor(next: Point) {
    cursorRef.current = next;
    setCursor(next);
    onMove(next.x, next.y);
  }

  function resetZoom() {
    setZoom(1);
    zoomRef.current = 1;
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!inputEnabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const state = gesture.current;
    const now = performance.now();

    if (pointers.current.size === 1) {
      state.startCount = 1;
      state.mode = zoomRef.current > 1.02 ? "pan" : "cursor";
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.startTime = now;
      state.moved = false;
      state.startPanX = panRef.current.x;
      state.startPanY = panRef.current.y;
    } else if (pointers.current.size === 2) {
      const [first, second] = Array.from(pointers.current.values());
      state.startCount = 2;
      state.mode = "none";
      state.startX = (first.x + second.x) / 2;
      state.startY = (first.y + second.y) / 2;
      state.startDist = Math.hypot(
        first.x - second.x,
        first.y - second.y,
      );
      state.startZoom = zoomRef.current;
      state.lastMidX = (first.x + second.x) / 2;
      state.lastMidY = (first.y + second.y) / 2;
      state.startTime = now;
      state.moved = false;
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = pointers.current.get(event.pointerId);
    if (!point) return;

    const previous = { x: point.x, y: point.y };
    point.x = event.clientX;
    point.y = event.clientY;
    const state = gesture.current;

    if (pointers.current.size >= 2) {
      const [first, second] = Array.from(pointers.current.values());
      const midX = (first.x + second.x) / 2;
      const midY = (first.y + second.y) / 2;
      const distance = Math.hypot(first.x - second.x, first.y - second.y);

      if (
        state.startDist > 0 &&
        Math.abs(distance / state.startDist - 1) > 0.08
      ) {
        const next = clamp(
          state.startZoom * (distance / state.startDist),
          1,
          3,
        );
        zoomRef.current = next;
        setZoom(next);
        if (next <= 1.02) {
          panRef.current = { x: 0, y: 0 };
          setPan({ x: 0, y: 0 });
        }
        state.moved = true;
      } else {
        const dx = midX - state.lastMidX;
        const dy = midY - state.lastMidY;
        if (Math.abs(dx) + Math.abs(dy) > 0.4) {
          scrollAcc.current.x += dx;
          scrollAcc.current.y += dy;
          if (
            Math.abs(scrollAcc.current.x) >= 8 ||
            Math.abs(scrollAcc.current.y) >= 8
          ) {
            onScroll(-scrollAcc.current.x * 4, -scrollAcc.current.y * 4);
            scrollAcc.current = { x: 0, y: 0 };
          }
        }
        if (Math.hypot(midX - state.startX, midY - state.startY) > 10) {
          state.moved = true;
        }
      }

      state.lastMidX = midX;
      state.lastMidY = midY;
      return;
    }

    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.01) return;
    if (
      Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > 6
    ) {
      state.moved = true;
    }

    if (state.mode === "pan" && zoomRef.current > 1.02) {
      const size = displayRef.current;
      const maxX = (size.width * (zoomRef.current - 1)) / 2;
      const maxY = (size.height * (zoomRef.current - 1)) / 2;
      const next = {
        x: clamp(panRef.current.x + dx, -maxX, maxX),
        y: clamp(panRef.current.y + dy, -maxY, maxY),
      };
      panRef.current = next;
      setPan(next);
    } else if (state.mode === "cursor") {
      const size = displayRef.current;
      const speed = 1.7;
      const next = {
        x: clamp(
          cursorRef.current.x + (dx * speed) / Math.max(size.width, 1),
          0,
          1,
        ),
        y: clamp(
          cursorRef.current.y + (dy * speed) / Math.max(size.height, 1),
          0,
          1,
        ),
      };
      pushCursor(next);
    }
  }

  function pointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const state = gesture.current;
    const duration = performance.now() - state.startTime;

    if (pointers.current.size === 0) {
      if (!state.moved && duration < 300) {
        const at = cursorRef.current;
        if (state.startCount >= 2) {
          onRightClick(at.x, at.y);
        } else {
          onClick(at.x, at.y);
        }
      }
      state.mode = "none";
      state.startCount = 0;
      state.startDist = 0;
      scrollAcc.current = { x: 0, y: 0 };
    } else if (pointers.current.size === 1) {
      // One finger lifted from a two-finger gesture: do not jump the cursor,
      // but remember that the gesture started with two fingers so the last
      // lift is still treated as a right-click.
      state.mode = "none";
      state.startDist = 0;
    }
  }

  function pointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current.mode = "none";
      gesture.current.startCount = 0;
      gesture.current.startDist = 0;
    }
  }

  const dot = ready ? "bg-emerald-400" : "bg-accent";
  const cursorLeft =
    display.width / 2 +
    (cursor.x * display.width - display.width / 2) * zoom +
    pan.x;
  const cursorTop =
    display.height / 2 +
    (cursor.y * display.height - display.height / 2) * zoom +
    pan.y;

  return (
    <motion.div
      key="remote"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex h-full flex-col bg-[#10141b] text-[#e0fbfc]"
    >
      <div className="z-20 flex items-center justify-between gap-3 bg-[#10141b] px-3 py-2.5 safe-top">
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-[#181d26]/90 px-3 py-2">
          <span className={`size-2 shrink-0 rounded-full ${dot}`} />
          <div className="min-w-0">
            <p className="max-w-[46vw] truncate text-xs font-bold">
              {ready?.deviceName ?? computer?.name ?? "Komputer"}
            </p>
            <p className="text-[10px] text-[#98c1d9]">
              {ready ? "Połączono" : "Łączymy…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {zoom > 1.02 && (
            <button
              type="button"
              onClick={resetZoom}
              aria-label="Przywróć widok"
              className="flex size-9 items-center justify-center rounded-xl bg-[#181d26]/90 text-[#e0fbfc]"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onFullscreen}
            aria-label={fullscreenOn ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
            className="flex size-9 items-center justify-center rounded-xl bg-[#181d26]/90 text-[#e0fbfc]"
          >
            {fullscreenOn ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            aria-label="Rozłącz"
            className="flex size-9 items-center justify-center rounded-xl bg-[#ee6c4d] text-[#e0fbfc]"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={padRef}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerCancel}
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
      >
        <div
          className="relative"
          style={{
            width: display.width || "100%",
            height: display.height || "100%",
          }}
        >
          <div
            className="h-full w-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center",
            }}
          >
            {demo ? (
              <DemoScreen />
            ) : frameUrl ? (
              <img
                src={frameUrl}
                alt="Podgląd ekranu komputera"
                draggable={false}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth && naturalHeight) {
                    onFrameSize({
                      width: naturalWidth,
                      height: naturalHeight,
                    });
                  }
                }}
                className="h-full w-full select-none object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-[#98c1d9]">
                <Loader2 className="size-8 animate-spin" />
                <p className="text-sm font-semibold">Łączymy obraz…</p>
              </div>
            )}
          </div>

          {!demo && frameUrl && inputEnabled && (
            <span
              aria-hidden
              className="pointer-events-none absolute z-10 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#ee6c4d] bg-[#e0fbfc]/25 shadow-[0_1px_6px_rgba(0,0,0,0.55)]"
              style={{ left: cursorLeft, top: cursorTop }}
            >
              <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ee6c4d]" />
            </span>
          )}
        </div>

        {zoom > 1.02 && (
          <span className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-[#181d26]/85 px-3 py-1 text-[10px] font-bold text-[#98c1d9]">
            {zoom.toFixed(1)}×
          </span>
        )}
      </div>

      <AnimatePresence>
        {showKeyboard && (
          <motion.div
            initial={{ y: 160, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 160, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-[#181d26] p-4 safe-bottom"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSendEnter();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Pisz na komputerze…"
                autoFocus
                enterKeyHint="enter"
                className="h-11 min-w-0 flex-1 rounded-2xl bg-[#212833] px-4 text-sm text-[#e0fbfc] outline-none placeholder:text-[#98c1d9]/60"
              />
              <button
                type="submit"
                className="flex h-11 items-center gap-2 rounded-2xl bg-[#ee6c4d] px-4 text-sm font-bold text-[#e0fbfc]"
              >
                Enter
              </button>
              <button
                type="button"
                onClick={onToggleKeyboard}
                aria-label="Ukryj klawiaturę"
                className="flex size-11 items-center justify-center rounded-2xl bg-[#212833] text-[#98c1d9]"
              >
                <X className="size-4" />
              </button>
            </form>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { label: "Backspace", key: "backspace" },
                { label: "Tab", key: "tab" },
                { label: "Esc", key: "escape" },
                { label: "↑", key: "up" },
                { label: "↓", key: "down" },
                { label: "←", key: "left" },
                { label: "→", key: "right" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onKey(item.key)}
                  className="rounded-xl bg-[#212833] px-3 py-2 text-xs font-semibold text-[#e0fbfc]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="z-20 flex items-center justify-center gap-1.5 overflow-x-auto bg-[#10141b] px-3 pb-3 pt-2 safe-bottom">
        <ControlButton
          label="Klawiatura"
          active={showKeyboard}
          onClick={onToggleKeyboard}
          disabled={!inputEnabled}
        >
          <Keyboard className="size-5" />
        </ControlButton>
        <ControlButton
          label="Prawy przycisk"
          onClick={() => onRightClick(cursorRef.current.x, cursorRef.current.y)}
          disabled={!inputEnabled}
        >
          <MousePointerClick className="size-5" />
        </ControlButton>
        <ControlButton
          label="Przewiń w górę"
          onClick={() => onScroll(0, -160)}
          disabled={!inputEnabled}
        >
          <ArrowUp className="size-5" />
        </ControlButton>
        <ControlButton
          label="Przewiń w dół"
          onClick={() => onScroll(0, 160)}
          disabled={!inputEnabled}
        >
          <ArrowDown className="size-5" />
        </ControlButton>
        <div className="mx-1 h-7 w-px shrink-0 bg-[#2a323f]" />
        <ControlButton
          label={fullscreenOn ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
          onClick={onFullscreen}
        >
          {fullscreenOn ? (
            <Minimize2 className="size-5" />
          ) : (
            <Maximize2 className="size-5" />
          )}
        </ControlButton>
      </div>

      {!inputEnabled && (
        <div className="absolute inset-x-0 bottom-20 z-20 mx-auto w-fit rounded-full bg-[#181d26] px-4 py-2 text-xs font-semibold text-[#98c1d9]">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="size-3.5" />
            Sterowanie jest wyłączone na komputerze
          </span>
        </div>
      )}
    </motion.div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors disabled:opacity-35 ${
        active ? "bg-[#ee6c4d] text-[#e0fbfc]" : "bg-[#212833] text-[#e0fbfc]"
      }`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const { theme, setTheme } = useMobileTheme();
  const [screen, setScreen] = useState<Screen>("boot");
  const [computer, setComputer] = useState<PairInfo | null>(() =>
    loadLastComputer(),
  );
  const [update, setUpdate] = useState<MobileUpdate | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [finding, setFinding] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [ready, setReady] = useState<ReadyInfo | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [draft, setDraft] = useState("");
  const [fullscreenOn, setFullscreenOn] = useState(false);
  const [frameSize, setFrameSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [demo, setDemo] = useState(false);
  const [appVersion, setAppVersion] = useState(APP_VERSION);
  const connection = useRef(new RemoteConnection());
  const autoSubmitted = useRef("");
  const draftRef = useRef("");
  const name = useMemo(phoneName, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let current = APP_VERSION;
      if (isTauri()) {
        try {
          const { getVersion } = await import("@tauri-apps/api/app");
          current = await getVersion();
        } catch {
          // Keep the built-in fallback.
        }
      }
      const timeout = new Promise<null>((resolve) =>
        window.setTimeout(() => resolve(null), 2000),
      );
      if (cancelled) return;
      setAppVersion(current);
      const result = await Promise.race([checkMobileUpdate(current), timeout]);
      if (cancelled) return;
      if (result) setUpdate(result);
      setScreen("pair");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const current = connection.current;
    return () => current.close();
  }, []);

  useEffect(() => {
    const listener = () => setFullscreenOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  // A complete code connects right away; there is no separate confirm button.
  useEffect(() => {
    if (screen !== "pair" || manualCode.length !== 6) return;
    if (autoSubmitted.current === manualCode) return;
    autoSubmitted.current = manualCode;
    void connectWithCode();
  }, [manualCode, screen]);

  function connect(info: PairInfo) {
    setError(null);
    setFrameUrl(null);
    setFrameSize(null);
    setReady(null);
    setDemo(false);
    setScreen("connecting");
    draftRef.current = "";
    setDraft("");

    // Keep the phone id and, when reconnecting to the same computer, its token
    // so the desktop can recognise us without a fresh pairing code.
    const previous = loadLastComputer();
    const sameComputer =
      previous && previous.host === info.host && previous.port === info.port;
    const merged: PairInfo = {
      ...info,
      deviceId: info.deviceId ?? deviceId(),
      token: info.token ?? (sameComputer ? previous?.token : undefined),
    };
    saveLastComputer(merged);
    setComputer(merged);

    connection.current.connect(merged, name, {
      onReady: (infoReady) => {
        if (infoReady.token) updateLastComputerToken(infoReady.token);
        setReady(infoReady);
        setInputEnabled(infoReady.inputEnabled);
        setScreen("remote");
      },
      onFrame: (url) => setFrameUrl(url),
      onError: (message) => {
        setError(message);
        setScreen("pair");
      },
      onClose: () => {
        setScreen("pair");
        setError("Połączenie zostało zakończone. Zeskanuj kod ponownie.");
      },
    });
  }

  function changeManualCode(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    if (clean.length < 6) autoSubmitted.current = "";
    setManualCode(clean);
  }

  function scan() {
    if (!isTauri()) {
      setError("Skanowanie kodu QR działa w aplikacji Bantrol na telefonie.");
      return;
    }
    setError(null);
    setScanning(true);
    void (async () => {
      try {
        // Ask for the Android camera permission before the WebView camera
        // preview starts; the native plugin owns the runtime permission.
        const plugin = await import("@tauri-apps/plugin-barcode-scanner");
        const permission = await plugin.checkPermissions();
        if (permission !== "granted") {
          const requested = await plugin.requestPermissions();
          if (requested !== "granted") {
            setError(
              "Brak dostępu do aparatu. Zezwól Bantrolowi na aparat w ustawieniach telefonu.",
            );
            return;
          }
        }
        setScannerOpen(true);
      } catch {
        // The overlay reports camera problems and offers the native fallback.
        setScannerOpen(true);
      } finally {
        setScanning(false);
      }
    })();
  }

  function handleScanResult(raw: string) {
    setScannerOpen(false);
    const info = parsePairingLink(raw);
    if (!info) {
      setError("To nie jest kod Bantrola. Zeskanuj kod z ekranu komputera.");
      return;
    }
    connect(info);
  }

  async function nativeScan() {
    setScannerOpen(false);
    setScanning(true);
    setError(null);
    try {
      const plugin = await import("@tauri-apps/plugin-barcode-scanner");

      const permission = await plugin.checkPermissions();
      if (permission !== "granted") {
        const requested = await plugin.requestPermissions();
        if (requested !== "granted") {
          setError(
            "Brak dostępu do aparatu. Zezwól Bantrolowi na aparat w ustawieniach telefonu.",
          );
          return;
        }
      }

      const result = await plugin.scan({
        windowed: true,
        formats: [plugin.Format.QRCode],
      });
      const info = parsePairingLink(result.content);
      if (!info) {
        setError("To nie jest kod Bantrola. Zeskanuj kod z ekranu komputera.");
        return;
      }
      connect(info);
    } catch {
      setError(
        "Nie udało się otworzyć aparatu. Sprawdź uprawnienia i spróbuj ponownie.",
      );
    } finally {
      setScanning(false);
    }
  }

  async function connectWithCode() {
    if (finding) return;
    const clean = manualCode.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) return;

    setError(null);
    setFinding(true);
    try {
      const last = loadLastComputer();
      let target: PairInfo | null = last;

      // A fresh install has no saved computer, so ask the local network where
      // Bantrol is running. Later logins use the remembered address instantly.
      if (!target) {
        const found = await discoverComputers();
        if (!found.length) {
          setError(
            "Nie znaleziono komputera w sieci. Sprawdź, czy Bantrol działa na komputerze.",
          );
          return;
        }
        const pick = found[0];
        target = {
          host: pick.host,
          port: pick.port,
          code: clean,
          name: pick.name,
        };
      }

      setManualCode("");
      autoSubmitted.current = "";
      connect({ ...target, code: clean, token: undefined });
    } finally {
      setFinding(false);
    }
  }

  async function installUpdate() {
    if (!update) return;
    setUpdateState("downloading");
    setUpdateProgress(0);
    setError(null);
    try {
      await downloadAndInstall(update, setUpdateProgress);
      setUpdateState("installing");
    } catch {
      setError(
        "Nie udało się zaktualizować. Sprawdź uprawnienia do instalowania aplikacji.",
      );
    } finally {
      window.setTimeout(() => setUpdateState("idle"), 1500);
    }
  }

  function disconnect() {
    connection.current.close();
    setScreen("pair");
    setReady(null);
    setFrameUrl(null);
    setShowKeyboard(false);
    draftRef.current = "";
    setDraft("");
  }

  function move(x: number, y: number) {
    connection.current.pointer("move", x, y);
  }

  function click(x: number, y: number) {
    connection.current.pointer("click", x, y, "left");
  }

  function rightClick(x: number, y: number) {
    connection.current.pointer("click", x, y, "right");
  }

  function scroll(dx: number, dy: number) {
    connection.current.scroll(dx, dy);
  }

  // Typing goes to the desktop as it happens, so no send button is needed.
  function updateDraft(value: string) {
    const previous = draftRef.current;
    if (value.length > previous.length) {
      connection.current.text(value.slice(previous.length));
    } else if (value.length < previous.length) {
      const removed = previous.length - value.length;
      for (let index = 0; index < removed; index += 1) {
        connection.current.key("backspace");
      }
    }
    draftRef.current = value;
    setDraft(value);
  }

  async function fullscreen() {
    const next = !fullscreenOn;
    setFullscreenOn(next);

    if (isTauri()) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setFullscreen(next);
        return;
      } catch {
        // Fall back to the WebView API below.
      }
    }

    try {
      if (next) {
        await document.documentElement.requestFullscreen?.();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      setFullscreenOn(!next);
    }
  }

  function demoMode() {
    setDemo(true);
    setReady({
      deviceName: "BANTROL-STUDIO",
      inputEnabled: true,
      clients: 1,
    });
    setScreen("remote");
  }

  return (
    <div className="h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {screen === "boot" && <BootScreen />}
        {screen === "pair" && (
          <PairScreen
            computer={computer}
            update={update}
            updateState={updateState}
            updateProgress={updateProgress}
            error={error}
            scanning={scanning}
            finding={finding}
            manualCode={manualCode}
            theme={theme}
            version={appVersion}
            onThemeChange={setTheme}
            onScan={scan}
            onManualCodeChange={changeManualCode}
            onManualSubmit={() => void connectWithCode()}
            onInstallUpdate={() => void installUpdate()}
            onReconnect={() => {
              if (computer) connect(computer);
            }}
            onForget={() => {
              forgetLastComputer();
              setComputer(null);
            }}
            onDismissError={() => setError(null)}
            onDemo={demoMode}
          />
        )}
        {screen === "connecting" && computer && (
          <ConnectingScreen
            computer={computer}
            onCancel={() => {
              connection.current.close();
              setScreen("pair");
            }}
          />
        )}
        {screen === "remote" && (
          <RemoteScreen
            ready={ready}
            computer={computer}
            frameUrl={frameUrl}
            demo={demo}
            inputEnabled={inputEnabled}
            showKeyboard={showKeyboard}
            draft={draft}
            fullscreenOn={fullscreenOn}
            onDraftChange={updateDraft}
            onSendEnter={() => {
              connection.current.key("enter");
              draftRef.current = "";
              setDraft("");
            }}
            onToggleKeyboard={() => setShowKeyboard((value) => !value)}
            onDisconnect={disconnect}
            onFullscreen={() => void fullscreen()}
            onMove={move}
            onClick={click}
            onRightClick={rightClick}
            onScroll={scroll}
            onKey={(key) => connection.current.key(key)}
            frameSize={frameSize}
            onFrameSize={setFrameSize}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scannerOpen && (
          <ScannerOverlay
            onResult={handleScanResult}
            onClose={() => setScannerOpen(false)}
            onFallback={() => void nativeScan()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
