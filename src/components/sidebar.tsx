import {
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "framer-motion";

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
  const clients = status?.clients ?? 0;

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
                "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors",
                active
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-2xl bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative size-4" />
              <span className="relative">{item.label}</span>
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
            {running ? "Gotowy na telefon" : "Połączenie wyłączone"}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-accent" />
            {running
              ? "Bezpieczne połączenie w Twojej sieci"
              : "Włącz połączenie na pulpicie"}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="size-3.5" />
            {clients === 0
              ? "Brak połączonych telefonów"
              : clients === 1
                ? "1 telefon połączony"
                : `${clients} telefony połączone`}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Motyw
          </p>
          <ThemeSwitcher value={theme} onChange={onThemeChange} />
        </div>

        <p className="px-1 text-[11px] text-muted-foreground">
          Bantrol 0.1.0 · Twój komputer pod ręką
        </p>
      </div>
    </aside>
  );
}
