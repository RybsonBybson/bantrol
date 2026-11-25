import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/tauri";

const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Jasny", icon: Sun },
  { value: "dark", label: "Ciemny", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSwitcher({
  value,
  onChange,
  className,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Motyw aplikacji"
      className={cn(
        "grid grid-cols-3 gap-1 rounded-2xl bg-secondary/20 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-xl text-[11px] font-semibold transition-colors",
              active
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
