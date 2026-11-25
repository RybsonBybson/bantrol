import {
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";
import type { ServerStatus, ThemeMode } from "@/lib/tauri";

const navItems = [
  { id: "dashboard", label: "Pulpit", icon: LayoutDashboard },
  { id: "settings", label: "Ustawienia", icon: Settings2 },
] as const;

export type View = (typeof navItems)[number]["id"];

export function Sidebar({
  view,
  onNavigate,
  theme,
  onThemeChange,
  status,
}: {
  view: View;
  onNavigate: (view: View) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  status: ServerStatus | null;
}) {
  const running = status?.running ?? false;

  return (
    <aside className="hidden h-full w-[264px] shrink-0 flex-col gap-8 overflow-y-auto rounded-3xl bg-card p-5 md:flex">
      <Brand />

      <nav className="flex flex-col gap-1.5" aria-label="Nawigacja główna">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="rounded-2xl bg-secondary/15 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {running ? (
              <Wifi className="size-3.5" />
            ) : (
              <WifiOff className="size-3.5" />
            )}
            {running ? "Sieć lokalna gotowa" : "Serwer wyłączony"}
          </div>
          <p className="mt-2 truncate text-sm font-semibold">
            {status?.url ?? "Uruchom serwer, aby połączyć telefon"}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            {status?.clients
              ? `${status.clients} aktywne połączenie`
              : "Brak połączonych urządzeń"}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Motyw
          </p>
          <ThemeSwitcher value={theme} onChange={onThemeChange} />
        </div>

        <p className="px-1 text-[11px] text-muted-foreground">
          Bantrol 0.1.0 · Tauri + Rust
        </p>
      </div>
    </aside>
  );
}
