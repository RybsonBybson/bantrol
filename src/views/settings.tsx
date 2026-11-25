import { useEffect, useState } from "react";
import {
  Gauge,
  LogOut,
  Minus,
  MonitorSmartphone,
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
import type { Settings, ThemeMode } from "@/lib/tauri";

const themeLabels: Record<ThemeMode, string> = {
  light: "Jasny",
  dark: "Ciemny",
  system: "System",
};

function smoothnessLabel(fps: number) {
  if (fps <= 8) return "Spokojna";
  if (fps <= 16) return "Płynna";
  return "Bardzo płynna";
}

function qualityLabel(quality: number) {
  if (quality <= 45) return "Oszczędna";
  if (quality <= 70) return "Wyraźna";
  return "Ostra";
}

const sizeLabels: Record<string, string> = {
  "960": "Oszczędny",
  "1280": "Zbalansowany",
  "1600": "Wyraźny",
  "1920": "Najostrzejszy",
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
        <span className="rounded-full bg-card px-3 py-1 text-xs font-bold">
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
                Wybierz wygodny odcień — Bantrol zadba o czytelność.
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
        description="Uruchamianie i dyskretna praca w tle."
      >
        <ToggleRow
          title="Uruchamiaj z komputerem"
          description="Bantrol włączy się razem z systemem i od razu będzie gotowy na telefon."
          checked={settings.autostart}
          onCheckedChange={(autostart) => onUpdate({ autostart })}
        />
        <ToggleRow
          title="Pracuj w tle"
          description="Zamknięcie okna schowa Bantrola do zasobnika. Połączenie z telefonem pozostanie aktywne."
          checked={settings.runInBackground}
          onCheckedChange={(runInBackground) => onUpdate({ runInBackground })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="subtle" onClick={onHide}>
            <Minus className="size-4" />
            Ukryj okno
          </Button>
          <Button variant="ghost" onClick={onQuit}>
            <LogOut className="size-4" />
            Zakończ aplikację
          </Button>
        </div>
      </Section>

      <Section
        icon={MonitorSmartphone}
        title="Połączenie"
        description="Zasady łączenia telefonu z komputerem."
      >
        <ToggleRow
          title="Wymagaj kodu parowania"
          description="Nowy telefon musi podać aktualny kod widoczny na pulpicie."
          checked={settings.requirePairing}
          onCheckedChange={(requirePairing) => onUpdate({ requirePairing })}
        />
        <ToggleRow
          title="Zezwalaj na sterowanie"
          description="Gdy wyłączone, telefon widzi tylko podgląd ekranu — bez kursora i kliknięć."
          checked={settings.inputEnabled}
          onCheckedChange={(inputEnabled) => onUpdate({ inputEnabled })}
        />
        <div className="rounded-2xl bg-secondary/10 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Połączenie działa wyłącznie między Twoim komputerem a telefonem w tej
          samej sieci.
        </div>
      </Section>

      <Section
        icon={Gauge}
        title="Obraz i płynność"
        description="Dopasuj podgląd do swojego telefonu i sieci."
      >
        <div className="rounded-2xl bg-secondary/10 p-4">
          <p className="text-sm font-semibold">Szczegółowość obrazu</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ostrzejszy obraz wygląda lepiej, ale potrzebuje więcej miejsca.
          </p>
          <Select
            value={String(settings.streamWidth)}
            onValueChange={(value) => onUpdate({ streamWidth: Number(value) })}
          >
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="960">Oszczędny</SelectItem>
              <SelectItem value="1280">Zbalansowany</SelectItem>
              <SelectItem value="1600">Wyraźny</SelectItem>
              <SelectItem value="1920">Najostrzejszy</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Wybrany: {sizeLabels[String(settings.streamWidth)] ?? "Zbalansowany"}
          </p>
        </div>

        <SliderRow
          title="Płynność"
          description="Jak często odświeża się podgląd ekranu."
          value={settings.streamFps}
          display={smoothnessLabel(settings.streamFps)}
          min={1}
          max={30}
          step={1}
          onCommit={(streamFps) => onUpdate({ streamFps })}
        />

        <SliderRow
          title="Jakość obrazu"
          description="Więcej szczegółów albo lżejsze przesyłanie."
          value={settings.jpegQuality}
          display={qualityLabel(settings.jpegQuality)}
          min={30}
          max={90}
          step={2}
          onCommit={(jpegQuality) => onUpdate({ jpegQuality })}
        />

        <div className="rounded-2xl bg-accent/10 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Podgląd uruchamia się sam, gdy połączysz telefon, i zatrzymuje się po
          jego rozłączeniu.
        </div>
      </Section>
    </div>
  );
}
