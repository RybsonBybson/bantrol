import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Keyboard,
  Loader2,
  LogOut,
  Maximize2,
  Monitor,
  Moon,
  MousePointerClick,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sun,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { RemoteConnection, type ReadyInfo } from "@/lib/connection";
import {
  deviceId,
  forgetLastComputer,
  isTauri,
  loadLastComputer,
  parsePairingLink,
  saveLastComputer,
  updateLastComputerToken,
  type PairInfo,
} from "@/lib/pairing";
import { checkMobileUpdate, openUpdate, type MobileUpdate } from "@/lib/updates";

const APP_VERSION = "0.1.0";
const DEMO = !isTauri();

type ThemeMode = "system" | "light" | "dark";
type Screen = "boot" | "pair" | "connecting" | "remote";

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

function ThemeToggle({
  theme,
  onChange,
  className = "",
}: {
  theme: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  className?: string;
}) {
  const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Jasny", icon: Sun },
    { value: "dark", label: "Ciemny", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div
      role="group"
      aria-label="Motyw aplikacji"
      className={`grid grid-cols-3 gap-1 rounded-2xl bg-secondary/20 p-1 ${className}`}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            onClick={() => onChange(option.value)}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-semibold transition-colors ${
              active
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            <span className="hidden min-[360px]:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
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

function PairScreen({
  computer,
  update,
  error,
  scanning,
  theme,
  onThemeChange,
  onScan,
  onReconnect,
  onForget,
  onDismissError,
  onDemo,
}: {
  computer: PairInfo | null;
  update: MobileUpdate | null;
  error: string | null;
  scanning: boolean;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onScan: () => void;
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
                Zeskanuj kod QR z ekranu komputera, aby połączyć urządzenia.
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
                  <Download className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Nowa wersja {update.version}</p>
                  <p className="text-xs text-muted-foreground">
                    Zaktualizuj Bantrola, aby mieć najnowsze udogodnienia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openUpdate(update.url)}
                  className="shrink-0 rounded-xl bg-card px-3 py-2 text-xs font-bold"
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

            {computer ? (
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
            ) : (
              <div className="rounded-3xl bg-card p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <ShieldCheck className="size-3.5" />
                  Bezpieczne parowanie
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Kod QR zawiera wszystko, czego potrzebuje telefon. Wystarczy
                  jedno skanowanie.
                </p>
              </div>
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
          <span>wersja {APP_VERSION}</span>
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
  onDraftChange,
  onSendText,
  onToggleKeyboard,
  onDisconnect,
  onFullscreen,
  onRightClick,
  onScroll,
  onPointer,
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
  onDraftChange: (value: string) => void;
  onSendText: () => void;
  onToggleKeyboard: () => void;
  onDisconnect: () => void;
  onFullscreen: () => void;
  onRightClick: (x: number, y: number) => void;
  onScroll: (dy: number) => void;
  onPointer: (
    action: "move" | "down" | "up",
    x: number,
    y: number,
  ) => void;
  onKey: (key: string) => void;
  frameSize: { width: number; height: number } | null;
  onFrameSize: (size: { width: number; height: number }) => void;
}) {
  const screenRef = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const lastPoint = useRef({ x: 0.5, y: 0.5 });

  function normalize(clientX: number, clientY: number) {
    const element = screenRef.current;
    if (!element) return lastPoint.current;
    const rect = element.getBoundingClientRect();
    const natural = frameSize ?? {
      width: rect.width,
      height: rect.height,
    };
    const scale = Math.min(
      rect.width / Math.max(natural.width, 1),
      rect.height / Math.max(natural.height, 1),
    );
    const width = Math.max(natural.width * scale, 1);
    const height = Math.max(natural.height * scale, 1);
    const left = rect.left + (rect.width - width) / 2;
    const top = rect.top + (rect.height - height) / 2;
    return {
      x: Math.min(1, Math.max(0, (clientX - left) / width)),
      y: Math.min(1, Math.max(0, (clientY - top) / height)),
    };
  }

  const dot = ready ? "bg-emerald-400" : "bg-accent";

  return (
    <motion.div
      key="remote"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex h-full flex-col bg-[#10141b] text-[#e0fbfc]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-[#10141b]/85 px-3 pb-3 pt-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-[#181d26]/90 px-3 py-2">
          <span className={`size-2 rounded-full ${dot}`} />
          <div className="min-w-0">
            <p className="max-w-[42vw] truncate text-xs font-bold">
              {ready?.deviceName ?? computer?.name ?? "Komputer"}
            </p>
            <p className="text-[10px] text-[#98c1d9]">
              {ready ? "Połączono" : "Łączymy…"}
            </p>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onFullscreen}
            aria-label="Pełny ekran"
            className="flex size-9 items-center justify-center rounded-xl bg-[#181d26]/90 text-[#e0fbfc]"
          >
            <Maximize2 className="size-4" />
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
        ref={screenRef}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!inputEnabled) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          pressed.current = true;
          const point = normalize(event.clientX, event.clientY);
          lastPoint.current = point;
          onPointer("down", point.x, point.y);
        }}
        onPointerMove={(event) => {
          if (!inputEnabled || !pressed.current) return;
          const point = normalize(event.clientX, event.clientY);
          lastPoint.current = point;
          onPointer("move", point.x, point.y);
        }}
        onPointerUp={(event) => {
          if (!inputEnabled || !pressed.current) return;
          pressed.current = false;
          const point = normalize(event.clientX, event.clientY);
          lastPoint.current = point;
          onPointer("up", point.x, point.y);
        }}
        onPointerCancel={() => {
          pressed.current = false;
        }}
        className="flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
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
                onFrameSize({ width: naturalWidth, height: naturalHeight });
              }
            }}
            className="max-h-full max-w-full select-none object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-[#98c1d9]">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm font-semibold">Łączymy obraz…</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showKeyboard && (
          <motion.div
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-x-0 bottom-0 z-30 safe-bottom rounded-t-3xl bg-[#181d26] p-4"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSendText();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Napisz coś…"
                autoFocus
                className="h-11 min-w-0 flex-1 rounded-2xl bg-[#212833] px-4 text-sm text-[#e0fbfc] outline-none placeholder:text-[#98c1d9]/60"
              />
              <button
                type="submit"
                className="flex h-11 items-center gap-2 rounded-2xl bg-[#ee6c4d] px-4 text-sm font-bold text-[#e0fbfc]"
              >
                Wyślij
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
                { label: "Enter", key: "enter" },
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

      <div className="z-20 flex items-center justify-center gap-1.5 bg-[#10141b] px-3 pb-3 pt-2">
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
          onClick={() => onRightClick(lastPoint.current.x, lastPoint.current.y)}
          disabled={!inputEnabled}
        >
          <MousePointerClick className="size-5" />
        </ControlButton>
        <ControlButton
          label="Przewiń w górę"
          onClick={() => onScroll(-160)}
          disabled={!inputEnabled}
        >
          <ArrowUp className="size-5" />
        </ControlButton>
        <ControlButton
          label="Przewiń w dół"
          onClick={() => onScroll(160)}
          disabled={!inputEnabled}
        >
          <ArrowDown className="size-5" />
        </ControlButton>
        <div className="mx-1 h-7 w-px bg-[#2a323f]" />
        <ControlButton label="Pełny ekran" onClick={onFullscreen}>
          <Maximize2 className="size-5" />
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
      className={`flex size-11 items-center justify-center rounded-2xl transition-colors disabled:opacity-35 ${
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
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [ready, setReady] = useState<ReadyInfo | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [draft, setDraft] = useState("");
  const [frameSize, setFrameSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [demo, setDemo] = useState(false);
  const connection = useRef(new RemoteConnection());
  const name = useMemo(phoneName, []);

  useEffect(() => {
    const timeout = new Promise<null>((resolve) =>
      window.setTimeout(() => resolve(null), 1400),
    );
    Promise.race([checkMobileUpdate(APP_VERSION), timeout]).then((result) => {
      if (result) setUpdate(result);
      setScreen("pair");
    });
  }, []);

  useEffect(() => {
    const current = connection.current;
    return () => current.close();
  }, []);

  function connect(info: PairInfo) {
    setError(null);
    setFrameUrl(null);
    setFrameSize(null);
    setReady(null);
    setDemo(false);
    setScreen("connecting");

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

  async function scan() {
    if (!isTauri()) {
      setError("Skanowanie kodu QR działa w aplikacji Bantrol na telefonie.");
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const { scan: scanCode, Format } = await import(
        "@tauri-apps/plugin-barcode-scanner"
      );
      const result = await scanCode({
        windowed: true,
        formats: [Format.QRCode],
      });
      const info = parsePairingLink(result.content);
      if (!info) {
        setError("To nie jest kod Bantrola. Zeskanuj kod z ekranu komputera.");
        return;
      }
      connect(info);
    } catch {
      setError("Nie udało się odczytać kodu. Spróbuj ponownie.");
    } finally {
      setScanning(false);
    }
  }

  function disconnect() {
    connection.current.close();
    setScreen("pair");
    setReady(null);
    setFrameUrl(null);
    setShowKeyboard(false);
  }

  function pointer(action: "move" | "down" | "up", x: number, y: number) {
    connection.current.pointer(action, x, y);
  }

  function scroll(dy: number) {
    connection.current.scroll(0, dy);
  }

  function rightClick(x: number, y: number) {
    connection.current.pointer("click", x, y, "right");
  }

  function fullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
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
            error={error}
            scanning={scanning}
            theme={theme}
            onThemeChange={setTheme}
            onScan={() => void scan()}
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
            onDraftChange={setDraft}
            onSendText={() => {
              connection.current.text(draft);
              setDraft("");
            }}
            onToggleKeyboard={() => setShowKeyboard((value) => !value)}
            onDisconnect={disconnect}
            onFullscreen={fullscreen}
            onRightClick={rightClick}
            onScroll={scroll}
            onPointer={pointer}
            onKey={(key) => connection.current.key(key)}
            frameSize={frameSize}
            onFrameSize={setFrameSize}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
