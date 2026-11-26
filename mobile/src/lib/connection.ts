import { deviceId, type PairInfo, type WolInfo } from "@/lib/pairing";

export interface ReadyInfo {
  deviceName: string;
  inputEnabled: boolean;
  clients: number;
  token?: string;
  wol?: WolInfo;
}

export type PowerAction =
  | "sleep"
  | "shutdown"
  | "restart"
  | "hibernate"
  | "lock";

export interface PhoneStatePayload {
  screen?: "boot" | "pair" | "connecting" | "remote";
  tab?: "pair" | "devices";
  keyboard?: boolean;
  inputEnabled?: boolean;
  name?: string;
  devices?: Array<{ name: string; online?: boolean }>;
}

export type ControlMessage =
  | { action: "tab"; value: "pair" | "devices" }
  | { action: "keyboard" }
  | { action: "back" }
  | { action: "tap"; x: number; y: number }
  | { action: "text"; text: string };

export interface ConnectionHandlers {
  onReady: (info: ReadyInfo) => void;
  onFrame: (url: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
  onControl?: (message: ControlMessage) => void;
}

/**
 * Sends a single power command on a short-lived connection. Used from the
 * saved-devices list, where the phone is not in remote-control mode.
 */
export function sendPowerAction(
  info: PairInfo,
  deviceName: string,
  action: PowerAction,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WebSocket(`ws://${info.host}:${info.port}/ws`);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // Already closed.
      }
      if (error) reject(error);
      else resolve();
    };
    const timer = window.setTimeout(
      () => finish(new Error("Komputer nie odpowiedział.")),
      timeoutMs,
    );

    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: "hello",
          code: info.code,
          name: deviceName,
          deviceId: info.deviceId ?? deviceId(),
          token: info.token,
        }),
      );

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as { type?: string; message?: string };
        if (message.type === "ready") {
          socket.send(JSON.stringify({ type: "power", action }));
          // Give the frame a moment to flush before the socket closes.
          window.setTimeout(() => finish(), 150);
        } else if (message.type === "error") {
          finish(new Error(message.message ?? "Nie udało się połączyć."));
        }
      } catch {
        // Ignore malformed messages.
      }
    };

    socket.onerror = () => finish(new Error("Nie udało się połączyć z komputerem."));
    socket.onclose = () => finish(new Error("Komputer nie odpowiedział."));
  });
}

export class RemoteConnection {
  private socket: WebSocket | null = null;
  private currentFrame: string | null = null;
  private closedByUser = false;

  connect(info: PairInfo, deviceName: string, handlers: ConnectionHandlers) {
    this.close();
    this.closedByUser = false;

    const socket = new WebSocket(`ws://${info.host}:${info.port}/ws`);
    socket.binaryType = "blob";
    this.socket = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "hello",
          code: info.code,
          name: deviceName,
          deviceId: info.deviceId ?? deviceId(),
          token: info.token,
        }),
      );
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data) as {
            type?: string;
            message?: string;
            deviceName?: string;
            inputEnabled?: boolean;
            clients?: number;
            token?: string;
            action?: string;
            value?: string;
            text?: string;
            x?: number;
            y?: number;
            wol?: {
              supported?: boolean;
              enabled?: boolean;
              mac?: string | null;
              broadcast?: string | null;
            };
          };
          if (message.type === "ready") {
            handlers.onReady({
              deviceName: message.deviceName ?? info.name,
              inputEnabled: message.inputEnabled ?? true,
              clients: message.clients ?? 1,
              token: message.token,
              wol: message.wol
                ? {
                    supported: message.wol.supported ?? false,
                    enabled: message.wol.enabled ?? false,
                    mac: message.wol.mac ?? null,
                    broadcast: message.wol.broadcast ?? null,
                  }
                : undefined,
            });
          } else if (message.type === "error") {
            handlers.onError(
              message.message ?? "Nie udało się połączyć z komputerem.",
            );
          } else if (message.type === "control" && handlers.onControl) {
            if (message.action === "tab") {
              handlers.onControl({
                action: "tab",
                value: message.value === "devices" ? "devices" : "pair",
              });
            } else if (message.action === "keyboard") {
              handlers.onControl({ action: "keyboard" });
            } else if (message.action === "back") {
              handlers.onControl({ action: "back" });
            } else if (message.action === "text") {
              handlers.onControl({ action: "text", text: message.text ?? "" });
            } else if (message.action === "tap") {
              handlers.onControl({
                action: "tap",
                x: message.x ?? 0,
                y: message.y ?? 0,
              });
            }
          }
        } catch {
          // Ignore malformed control messages.
        }
        return;
      }

      const blob =
        event.data instanceof Blob ? event.data : new Blob([event.data]);
      const next = URL.createObjectURL(blob);
      const previous = this.currentFrame;
      this.currentFrame = next;
      handlers.onFrame(next);
      if (previous) {
        window.setTimeout(() => URL.revokeObjectURL(previous), 1500);
      }
    };

    socket.onerror = () => {
      handlers.onError("Nie udało się połączyć. Sprawdź, czy komputer jest gotowy.");
    };

    socket.onclose = () => {
      if (!this.closedByUser) handlers.onClose();
    };
  }

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private send(payload: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  pointer(
    action: "move" | "down" | "up" | "click",
    x: number,
    y: number,
    button: "left" | "right" = "left",
  ) {
    this.send({ type: "pointer", action, x, y, button });
  }

  scroll(dx: number, dy: number) {
    this.send({ type: "pointer", action: "scroll", dx, dy });
  }

  key(name: string) {
    this.send({ type: "key", key: name });
  }

  text(value: string) {
    if (!value) return;
    this.send({ type: "text", text: value });
  }

  /** Reports what the phone shows so the desktop can mirror it. */
  state(state: PhoneStatePayload) {
    this.send({ type: "phone_state", state });
  }

  /** Asks the computer to sleep, shut down, restart, hibernate or lock. */
  power(action: PowerAction) {
    this.send({ type: "power", action });
  }

  close() {
    this.closedByUser = true;
    if (this.currentFrame) {
      URL.revokeObjectURL(this.currentFrame);
      this.currentFrame = null;
    }
    this.socket?.close();
    this.socket = null;
  }
}
