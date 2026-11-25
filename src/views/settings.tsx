import { useEffect, useState } from "react";
import { Gauge, MonitorSmartphone, Palette, Power } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { AutostartMode, Settings, ThemeMode } from "@/lib/tauri";

/** Presets shared by the image select and the sliders below it. */
const IMAGE_PRESETS: Record<
  string,
  { label: string; width: number; fps: number; quality: number }
> = {
  oszczedny: { label: "Oszczędny", width: 960, fps: 8, quality: 46 },
  zbalansowany: { label: "Zbalansowany", width: 1280, fps: 12, quality: 58 },
  wyrazny: { label: "Wyraźny", width: 1600, fps: 18, quality: 70 },
  ostry: { label: "Ostry", width: 1920, fps: 24, quality: 80 },
};

const AUTOSTART_OPTIONS: Array<{ value: AutostartMode; label: string }> = [
  { value: "off", label: "Nie" },
  { value: "normal", label: "Uruchamiaj z komputerem" },
  { value: "minimized", label: "Uruchamiaj zminimalizowane" },
];

function currentPreset(settings: Settings) {
  const match = Object.entries(IMAGE_PRESETS).find(
    ([, preset]) =>
      preset.width === settings.streamWidth &&
      preset.fps === settings.streamFps &&
      preset.quality === settings.jpegQuality,
  );
  return match ? match[0] : "wlasny";
}

function smoothnessLabel(fps: number) {
  if (fps <= 8) return "Spokojna";
  if (fps <= 16) return "Płynna";
  return "Bardzo płynna";
}

function qualityLabel(quality: number) {
  if (quality <= 48) return "Oszczędna";
  if (quality <= 70) return "Wyraźna";
  return "Ostra";
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 p-6">
      <CardHeader className="flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/20">
          <Icon className="size-4.5" />
        </span>
        <CardTitle>{title}</CardTitle>
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
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SliderRow({
  title,
  hint,
  value,
  display,
  min,
  max,
  step,
  onCommit,
}: {
  title: string;
  hint: string;
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
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-bold tabular-nums">
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
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function SettingsView({
  settings,
  onUpdate,
}: {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}) {
  const preset = currentPreset(settings);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Section icon={Palette} title="Wygląd">
        <div className="rounded-2xl bg-secondary/10 p-4">
          <ThemeSwitcher
            value={settings.theme}
            onChange={(theme: ThemeMode) => onUpdate({ theme })}
          />
        </div>
      </Section>

      <Section icon={Power} title="System">
        <div className="rounded-2xl bg-secondary/10 p-4">
          <p className="text-sm font-semibold">Uruchamianie</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Co ma się dziać, gdy włączasz komputer.
          </p>
          <Select
            value={settings.autostartMode}
            onValueChange={(value) =>
              onUpdate({ autostartMode: value as AutostartMode })
            }
          >
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTOSTART_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ToggleRow
          title="Pracuj w tle"
          description="Zamknięcie okna chowa Bantrola do zasobnika."
          checked={settings.runInBackground}
          onCheckedChange={(runInBackground) => onUpdate({ runInBackground })}
        />
      </Section>

      <Section icon={MonitorSmartphone} title="Połączenie">
        <ToggleRow
          title="Wymagaj kodu parowania"
          description="Nowy telefon musi podać kod z ekranu komputera."
          checked={settings.requirePairing}
          onCheckedChange={(requirePairing) => onUpdate({ requirePairing })}
        />
        <ToggleRow
          title="Zapamiętuj telefony"
          description="Zapisane telefony łączą się bez kodu."
          checked={settings.rememberDevices}
          onCheckedChange={(rememberDevices) => onUpdate({ rememberDevices })}
        />
        <ToggleRow
          title="Zezwalaj na sterowanie"
          description="Bez tego telefon tylko ogląda ekran."
          checked={settings.inputEnabled}
          onCheckedChange={(inputEnabled) => onUpdate({ inputEnabled })}
        />
      </Section>

      <Section icon={Gauge} title="Obraz">
        <div className="rounded-2xl bg-secondary/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Ustawienie obrazu</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Wybierz gotowy zestaw albo dostrój suwakami.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-bold">
              {preset === "wlasny"
                ? "Własny"
                : IMAGE_PRESETS[preset].label}
            </span>
          </div>
          <Select
            value={preset}
            onValueChange={(key) => {
              const next = IMAGE_PRESETS[key];
              if (next) {
                onUpdate({
                  streamWidth: next.width,
                  streamFps: next.fps,
                  jpegQuality: next.quality,
                });
              }
            }}
          >
            <SelectTrigger className="mt-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oszczedny">
                Oszczędny · 960 px · 8 fps · 46%
              </SelectItem>
              <SelectItem value="zbalansowany">
                Zbalansowany · 1280 px · 12 fps · 58%
              </SelectItem>
              <SelectItem value="wyrazny">
                Wyraźny · 1600 px · 18 fps · 70%
              </SelectItem>
              <SelectItem value="ostry">
                Ostry · 1920 px · 24 fps · 80%
              </SelectItem>
              <SelectItem value="wlasny">Własny (suwaki poniżej)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SliderRow
          title="Rozdzielczość"
          hint="Szerokość obrazu wysyłanego na telefon"
          value={settings.streamWidth}
          display={`${settings.streamWidth} px`}
          min={480}
          max={2560}
          step={80}
          onCommit={(streamWidth) => onUpdate({ streamWidth })}
        />

        <SliderRow
          title="Płynność"
          hint="Ile klatek na sekundę odświeża się obraz"
          value={settings.streamFps}
          display={`${settings.streamFps} fps`}
          min={1}
          max={30}
          step={1}
          onCommit={(streamFps) => onUpdate({ streamFps })}
        />
        <p className="-mt-2 px-1 text-[11px] text-muted-foreground">
          Teraz: {smoothnessLabel(settings.streamFps)}.
        </p>

        <SliderRow
          title="Jakość obrazu"
          hint="Wyższa jakość = ostrzejszy obraz, więcej danych"
          value={settings.jpegQuality}
          display={`${settings.jpegQuality}%`}
          min={30}
          max={90}
          step={2}
          onCommit={(jpegQuality) => onUpdate({ jpegQuality })}
        />
        <p className="-mt-2 px-1 text-[11px] text-muted-foreground">
          Teraz: {qualityLabel(settings.jpegQuality)}.
        </p>
      </Section>
    </div>
  );
}
