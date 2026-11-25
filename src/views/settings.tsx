import { useEffect, useState } from "react";
import {
  Gauge,
  LogOut,
  Minus,
  Network,
  Palette,
  Power,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { cn } from "@/lib/utils";
import type { Settings, ThemeMode } from "@/lib/tauri";

const themeLabels: Record<ThemeMode, string> = {
  light: "Jasny",
  dark: "Ciemny",
  system: "System",
};

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/20">
          <Icon className="size-4.5" />
        </span>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-0.5">{description}</CardDescription>
        </div>
      </CardHeader>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl bg-secondary/10 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SliderRow({
  title,
  description,
  value,
  display,
  min,
  max,
  step,
  onCommit,
}: {
  title: string;
  description: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <div className="rounded-2xl bg-secondary/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-card px-3 py-1 text-xs font-bold tabular-nums">
          {display}
        </span>
      </div>
      <Slider
        className="mt-4"
        value={[local]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => setLocal(values[0])}
        onValueCommit={(values) => onCommit(values[0])}
      />
    </div>
  );
}

export function SettingsView({
  settings,
  onUpdate,
  onHide,
  onQuit,
}: {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
  onHide: () => void;
  onQuit: () => void;
}) {
  const [portDraft, setPortDraft] = useState(String(settings.port));

  useEffect(() => {
    setPortDraft(String(settings.port));
  }, [settings.port]);

  function commitPort() {
    const value = Number(portDraft);
    if (!Number.isFinite(value) || value < 1024 || value > 65535) {
      setPortDraft(String(settings.port));
      return;
    }
    const next = Math.round(value);
    setPortDraft(String(next));
    if (next !== settings.port) onUpdate({ port: next });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Section
        icon={Palette}
        title="Wygląd"
        description="Motyw jasny, ciemny lub dopasowany do systemu."
      >
        <div className="rounded-2xl bg-secondary/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Motyw aplikacji</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Paleta Dusk Blue, Powder Blue, Light Cyan, Burnt Peach i Ink
                Black.
              </p>
            </div>
            <span className="rounded-full bg-card px-3 py-1 text-xs font-bold">
              {themeLabels[settings.theme]}
            </span>
          </div>
          <ThemeSwitcher
            className="mt-4"
            value={settings.theme}
            onChange={(theme: ThemeMode) => onUpdate({ theme })}
          />
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-secondary/10 px-4 py-3 text-xs text-muted-foreground">
          <Save className="size-3.5 shrink-0" />
          Zmiany zapisują się automatycznie i są pamiętane po restarcie.
        </div>
      </Section>

      <Section
        icon={Power}
        title="System"
        description="Uruchamianie i praca w tle."
      >
        <ToggleRow
          title="Autostart z systemem"
          description="Bantrol uruchomi się razem z komputerem i od razu wystartuje serwer."
          checked={settings.autostart}
          onCheckedChange={(autostart) => onUpdate({ autostart })}
        />
        <ToggleRow
          title="Praca w zasobniku systemowym"
          description="Zamknięcie okna ukryje Bantrola do trayu. Serwer i połączenie pozostaną aktywne."
          checked={settings.runInBackground}
          onCheckedChange={(runInBackground) => onUpdate({ runInBackground })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="subtle" onClick={onHide}>
            <Minus className="size-4" />
            Ukryj do trayu
          </Button>
          <Button variant="ghost" onClick={onQuit}>
            <LogOut className="size-4" />
            Zakończ aplikację
          </Button>
        </div>
      </Section>

      <Section
        icon={Network}
        title="Sieć i dostęp"
        description="Port, interfejs oraz zasady łączenia telefonu."
      >
        <div className="rounded-2xl bg-secondary/10 p-4">
          <p className="text-sm font-semibold">Port serwera</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Zakres 1024–65535. Zmiana zrestartuje serwer lokalny.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              inputMode="numeric"
              value={portDraft}
              onChange={(event) =>
                setPortDraft(event.target.value.replace(/\D/g, "").slice(0, 5))
              }
              onBlur={commitPort}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitPort();
              }}
              className="max-w-40 tabular-nums"
            />
            <Button variant="secondary" onClick={commitPort}>
              Zastosuj
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-secondary/10 p-4">
          <p className="text-sm font-semibold">Interfejs sieciowy</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Wszystkie interfejsy pozwalają połączyć się telefonowi w Wi-Fi.
          </p>
          <Select
            value={settings.bindAddress}
            onValueChange={(bindAddress) => onUpdate({ bindAddress })}
          >
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.0.0.0">Wszystkie (Wi-Fi / LAN)</SelectItem>
              <SelectItem value="127.0.0.1">Tylko ten komputer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ToggleRow
          title="Wymagaj kodu parowania"
          description="Nowe połączenia z telefonu muszą podać aktualny kod widoczny na pulpicie."
          checked={settings.requirePairing}
          onCheckedChange={(requirePairing) => onUpdate({ requirePairing })}
        />
        <ToggleRow
          title="Zezwalaj na sterowanie"
          description="Gdy wyłączone, telefon widzi tylko podgląd ekranu bez ruchu kursora i kliknięć."
          checked={settings.inputEnabled}
          onCheckedChange={(inputEnabled) => onUpdate({ inputEnabled })}
        />
      </Section>

      <Section
        icon={Gauge}
        title="Stream ekranu"
        description="Kompromis między płynnością a obciążeniem Wi-Fi."
      >
        <div className="rounded-2xl bg-secondary/10 p-4">
          <p className="text-sm font-semibold">Szerokość obrazu</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mniejsza szerokość to niższe opóźnienie i mniejsze zużycie pasma.
          </p>
          <Select
            value={String(settings.streamWidth)}
            onValueChange={(value) => onUpdate({ streamWidth: Number(value) })}
          >
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="960">960 px · oszczędnie</SelectItem>
              <SelectItem value="1280">1280 px · zbalansowane</SelectItem>
              <SelectItem value="1600">1600 px · ostry obraz</SelectItem>
              <SelectItem value="1920">1920 px · maksymalna jakość</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SliderRow
          title="Liczba klatek"
          description="Ile razy na sekundę odświeżany jest podgląd."
          value={settings.streamFps}
          display={`${settings.streamFps} fps`}
          min={1}
          max={30}
          step={1}
          onCommit={(streamFps) => onUpdate({ streamFps })}
        />

        <SliderRow
          title="Jakość JPEG"
          description="Wyższa jakość zwiększa rozmiar klatek."
          value={settings.jpegQuality}
          display={`${settings.jpegQuality}%`}
          min={30}
          max={90}
          step={2}
          onCommit={(jpegQuality) => onUpdate({ jpegQuality })}
        />

        <div
          className={cn(
            "rounded-2xl bg-accent/10 px-4 py-3 text-xs leading-relaxed text-muted-foreground",
          )}
        >
          Streaming startuje automatycznie, gdy tylko połączy się pierwszy
          telefon, i zatrzymuje się po rozłączeniu ostatniego klienta.
        </div>
      </Section>
    </div>
  );
}
