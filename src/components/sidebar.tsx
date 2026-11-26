import { LayoutDashboard, Settings2, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/tauri";

const navItems = [
  { id: "dashboard", label: "Pulpit", icon: LayoutDashboard },
  { id: "phones", label: "Telefony", icon: Smartphone },
  { id: "settings", label: "Ustawienia", icon: Settings2 },
] as const;

export type View = (typeof navItems)[number]["id"];

export function Sidebar({
  view,
  onNavigate,
  theme,
  onThemeChange,
  version,
}: {
  view: View;
  onNavigate: (view: View) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  version: string;
}) {
  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col gap-8 overflow-y-auto rounded-3xl bg-card p-5 md:flex">
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
        <ThemeSwitcher value={theme} onChange={onThemeChange} />
        <p className="px-1 text-[11px] text-muted-foreground">
          Bantrol {version || "—"}
        </p>
      </div>
    </aside>
  );
}
