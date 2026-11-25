import { Minus, Square, X } from "lucide-react";
import { motion } from "framer-motion";

import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import {
  closeWindow,
  isTauri,
  minimizeWindow,
  startDragging,
  toggleMaximize,
} from "@/lib/tauri";

const APP_VERSION = "0.1.0";

function ControlButton({
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
        "flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors",
        danger
          ? "hover:bg-accent hover:text-accent-foreground"
          : "hover:bg-secondary/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Titlebar({ running }: { running: boolean }) {
  return (
    <header
      onDoubleClick={() => void toggleMaximize()}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest("button")) return;
        void startDragging();
      }}
      className="flex h-13 shrink-0 select-none items-center justify-between gap-3 px-4"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <motion.img
          src="/bantrol-logo.svg"
          alt="Logo Bantrol"
          className="size-7 shrink-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        />
        <span className="text-sm font-bold tracking-tight">Bantrol</span>
        <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          v{APP_VERSION}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <StatusPill running={running} />
        <div className="ml-1 flex items-center gap-0.5 rounded-2xl bg-card/70 p-1">
          <ControlButton
            label="Minimalizuj"
            onClick={() => void minimizeWindow()}
          >
            <Minus className="size-4" />
          </ControlButton>
          <ControlButton
            label="Maksymalizuj"
            onClick={() => void toggleMaximize()}
          >
            <Square className="size-3.5" />
          </ControlButton>
          <ControlButton
            label="Zamknij"
            danger
            onClick={() => {
              if (!isTauri()) return;
              void closeWindow();
            }}
          >
            <X className="size-4" />
          </ControlButton>
        </div>
      </div>
    </header>
  );
}
