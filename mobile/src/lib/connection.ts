import { deviceId, type PairInfo } from "@/lib/pairing";

export interface ReadyInfo {
  deviceName: string;
  inputEnabled: boolean;
  clients: number;
  token?: string;
}

export interface ConnectionHandlers {
  onReady: (info: ReadyInfo) => void;
  onFrame: (url: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
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
          };
          if (message.type === "ready") {
            handlers.onReady({
              deviceName: message.deviceName ?? info.name,
              inputEnabled: message.inputEnabled ?? true,
              clients: message.clients ?? 1,
              token: message.token,
            });
          } else if (message.type === "error") {
            handlers.onError(
              message.message ?? "Nie udało się połączyć z komputerem.",
            );
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
