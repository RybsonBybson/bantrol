import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowLeft,
  Keyboard,
  Loader2,
  Minus,
  QrCode,
  Send,
  Smartphone,
  Square,
  WifiOff,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

import {
  getControllerDevice,
  getLatestFrame,
  getPhoneState,
  getStatus,
  isTauri,
  sendPhoneControl,
  type PhoneState,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

function WindowButton({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors",
        danger
          ? "hover:bg-accent hover:text-accent-foreground"
          : "hover:bg-secondary/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PhoneHomePreview({
  state,
  name,
}: {
  state: PhoneState | null;
  name: string;
}) {
  const tab = state?.tab ?? "pair";
  const devices = state?.devices ?? [];

  return (
    <div className="flex h-full flex-col bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <img src="/bantrol-logo.svg" alt="" className="size-7" />
          <span className="text-sm font-bold tracking-tight">Bantrol</span>
        </div>
        <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
          {name}
        </span>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        {tab === "pair" ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-card">
              <QrCode className="size-7 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold">Zeskanuj kod QR</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                z ekranu komputera
              </p>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  key={index}
                  className="flex size-6 items-center justify-center rounded-lg bg-secondary/20 text-[10px] font-bold text-muted-foreground"
                >
                  •
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="px-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Urządzenia
            </p>
            {devices.length ? (
              devices.map((device) => (
                <div
                  key={device.name}
                  className="flex items-center gap-2 rounded-xl bg-card px-2.5 py-2"
                >
                  <span className="flex size-7 items-center justify-center rounded-lg bg-secondary/25">
                    <Smartphone className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                    {device.name}
                  </span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      device.online ? "bg-accent" : "bg-muted-foreground/40",
                    )}
                  />
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-card px-3 py-4 text-center text-[10px] text-muted-foreground">
                Brak zapisanych telefonów.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-center gap-8 rounded-2xl bg-card py-2.5">
        <QrCode
          className={cn(
            "size-4",
            tab === "pair" ? "text-accent" : "text-muted-foreground",
          )}
        />
        <Smartphone
          className={cn(
            "size-4",
            tab === "devices" ? "text-accent" : "text-muted-foreground",
          )}
        />
      </div>
    </div>
  );
}

export function PhoneControlView({
  label,
  demoDeviceId,
}: {
  label: string;
  demoDeviceId?: string | null;
}) {
  const demo = !isTauri();
  const [deviceId, setDeviceId] = useState<string | null>(demoDeviceId ?? null);
  const [name, setName] = useState("Telefon");
  const [state, setState] = useState<PhoneState | null>(
    demo
      ? { screen: "pair", tab: "pair", name: "Telefon", devices: [] }
      : null,
  );
  const [frame, setFrame] = useState<string | null>(null);
  const [text, setText] = useState("");
  const frameRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let id = demoDeviceId ?? null;
      if (!id && isTauri()) {
        id = await getControllerDevice(label);
      }
      if (!alive) return;
      setDeviceId(id);

      try {
        const status = await getStatus();
        const device = status.savedDevices.find((item) => item.id === id);
        if (alive && device) setName(device.name);
        else if (alive && id) setName("Telefon");
      } catch {
        // The name is cosmetic; the state poll below reports connectivity.
      }
    })();
    return () => {
      alive = false;
    };
  }, [demoDeviceId, label]);

  useEffect(() => {
    if (!deviceId || demo) return;
    let alive = true;

    const tick = async () => {
      try {
        const nextState = await getPhoneState(deviceId);
        if (!alive) return;
        setState(nextState);
        if (nextState?.name) setName(nextState.name);

        // The phone shows its own screen (the desktop), so mirror that frame
        // only while it is actually in remote-control mode.
        if (nextState?.screen === "remote") {
          const nextFrame = await getLatestFrame();
          if (!alive) return;
          if (nextFrame && nextFrame !== frameRef.current) {
            frameRef.current = nextFrame;
            setFrame(nextFrame);
          }
        } else if (frameRef.current) {
          frameRef.current = null;
          setFrame(null);
        }
      } catch {
        if (alive) setState(null);
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 450);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [deviceId, demo]);

  function control(message: Record<string, unknown>) {
    if (!deviceId) return;
    void sendPhoneControl(deviceId, message);
  }

  function tap(event: React.MouseEvent<HTMLDivElement>) {
    if (!deviceId || state?.screen !== "remote") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    control({
      action: "tap",
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  function sendText() {
    const value = text.trim();
    if (!value) return;
    control({ action: "text", text: value });
    setText("");
  }

  function windowAction(action: "minimize" | "maximize" | "close") {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    if (action === "minimize") void window.minimize();
    if (action === "maximize") void window.toggleMaximize();
    if (action === "close") void window.close();
  }

  const online = Boolean(state) && !demo;
  const remote = state?.screen === "remote";
  const keyboard = Boolean(state?.keyboard);

  return (
    <div className="flex h-full flex-col bg-background">
      <header
        data-tauri-drag-region
        className="flex h-12 shrink-0 select-none items-center justify-between gap-3 px-3"
      >
        <div data-tauri-drag-region className="flex min-w-0 items-center gap-2">
          <img
            data-tauri-drag-region
            src="/bantrol-logo.svg"
            alt="Logo Bantrol"
            className="size-6 shrink-0"
          />
          <div data-tauri-drag-region className="min-w-0">
            <p className="truncate text-xs font-bold leading-tight">{name}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">
              Podgląd telefonu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 rounded-2xl bg-card/70 p-1">
          <WindowButton label="Minimalizuj" onClick={() => windowAction("minimize")}>
            <Minus className="size-3.5" />
          </WindowButton>
          <WindowButton label="Maksymalizuj" onClick={() => windowAction("maximize")}>
            <Square className="size-3" />
          </WindowButton>
          <WindowButton label="Zamknij" danger onClick={() => windowAction("close")}>
            <X className="size-3.5" />
          </WindowButton>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-4">
        <div className="flex w-full max-w-[340px] items-center justify-between gap-2 rounded-2xl bg-card px-3 py-2">
          <span className="flex items-center gap-2 text-xs font-semibold">
            <span
              className={cn(
                "size-1.5 rounded-full",
                online || demo ? "bg-accent" : "bg-muted-foreground/40",
              )}
            />
            {demo ? "Podgląd" : online ? "Połączono" : "Offline"}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {remote
              ? "Sterujesz komputerem"
              : state?.tab === "devices"
                ? "Urządzenia"
                : "Parowanie"}
          </span>
        </div>

        <motion.div
          layout
          className="relative w-full max-w-[320px] shrink-0 rounded-[2.6rem] bg-[#10141b] p-2 shadow-[0_18px_50px_rgba(24,29,38,0.28)]"
        >
          <span className="absolute left-1/2 top-3 z-10 h-1 w-14 -translate-x-1/2 rounded-full bg-white/15" />
          <div className="relative flex aspect-[9/18] w-full flex-col overflow-hidden rounded-[2.15rem] bg-background">
            {remote ? (
              frame ? (
                <div
                  onClick={tap}
                  className="relative flex h-full w-full cursor-crosshair items-center justify-center bg-[#10141b]"
                >
                  <img
                    src={frame}
                    alt="Podgląd telefonu"
                    draggable={false}
                    className="h-full w-full select-none object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                  <p className="text-[11px] font-semibold">Czekamy na obraz…</p>
                </div>
              )
            ) : (
              <PhoneHomePreview state={state} name={name} />
            )}

            {!online && !demo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 px-6 text-center">
                <WifiOff className="size-7 text-muted-foreground" />
                <p className="text-xs font-semibold">Telefon jest offline</p>
                <p className="text-[11px] text-muted-foreground">
                  Włącz Bantrola na telefonie i połącz go z komputerem.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <div className="grid w-full max-w-[340px] grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => control({ action: "tab", value: "pair" })}
            disabled={!online}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-[10px] font-semibold disabled:opacity-40"
          >
            <QrCode className="size-4" />
            Parowanie
          </button>
          <button
            type="button"
            onClick={() => control({ action: "tab", value: "devices" })}
            disabled={!online}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-[10px] font-semibold disabled:opacity-40"
          >
            <Smartphone className="size-4" />
            Urządzenia
          </button>
          <button
            type="button"
            onClick={() => control({ action: "keyboard" })}
            disabled={!online || !remote}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-[10px] font-semibold disabled:opacity-40",
              keyboard ? "bg-accent text-accent-foreground" : "bg-card",
            )}
          >
            <Keyboard className="size-4" />
            Klawiatura
          </button>
          <button
            type="button"
            onClick={() => control({ action: "back" })}
            disabled={!online}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-[10px] font-semibold disabled:opacity-40"
          >
            <ArrowLeft className="size-4" />
            Wstecz
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendText();
          }}
          className="flex w-full max-w-[340px] items-center gap-2 rounded-2xl bg-card p-1.5"
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Napisz na telefonie…"
            aria-label="Tekst do telefonu"
            disabled={!online || !remote}
            className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-xs outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!online || !remote || !text.trim()}
            aria-label="Wyślij tekst"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>

        <p className="max-w-[340px] pb-1 text-center text-[10px] leading-relaxed text-muted-foreground">
          {remote
            ? "Kliknij podgląd, aby kliknąć na telefonie."
            : "Telefon steruje komputerem. Tutaj możesz przełączać jego ekrany."}
        </p>
      </main>
    </div>
  );
}
