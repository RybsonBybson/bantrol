import { useEffect, useState } from "react";
import {
  Gauge,
  LogOut,
  Minus,
  MonitorSmartphone,
  Palette,
  Power,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { Settings, ThemeMode } from "@/lib/tauri";

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
  checked,
  onCheckedChange,
}: {
  title: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-2xl bg-secondary/10 px-4 py-3.5">
      <p className="text-sm font-semibold">{title}</p>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SliderRow({
  title,
  value,
  display,
  min,
  max,
  step,
  onCommit,
}: {
  title: string;
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
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold">{title}</p>
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
      <Section icon={Palette} title="Wygląd">
        <div className="rounded-2xl bg-secondary/10 p-4">
          <ThemeSwitcher
            value={settings.theme}
            onChange={(theme: ThemeMode) => onUpdate({ theme })}
          />
        </div>
      </Section>

      <Section icon={Power} title="System">
        <ToggleRow
          title="Uruchamiaj z komputerem"
          checked={settings.autostart}
          onCheckedChange={(autostart) => onUpdate({ autostart })}
        />
        <ToggleRow
          title="Pracuj w tle"
          checked={settings.runInBackground}
          onCheckedChange={(runInBackground) => onUpdate({ runInBackground })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="subtle" onClick={onHide}>
            <Minus className="size-4" />
            Ukryj
          </Button>
          <Button variant="ghost" onClick={onQuit}>
            <LogOut className="size-4" />
            Zakończ
          </Button>
        </div>
      </Section>

      <Section icon={MonitorSmartphone} title="Połączenie">
        <ToggleRow
          title="Wymagaj kodu parowania"
          checked={settings.requirePairing}
          onCheckedChange={(requirePairing) => onUpdate({ requirePairing })}
        />
        <ToggleRow
          title="Zapamiętuj telefony"
          checked={settings.rememberDevices}
          onCheckedChange={(rememberDevices) => onUpdate({ rememberDevices })}
        />
        <ToggleRow
          title="Zezwalaj na sterowanie"
          checked={settings.inputEnabled}
          onCheckedChange={(inputEnabled) => onUpdate({ inputEnabled })}
        />
      </Section>

      <Section icon={Gauge} title="Obraz">
        <div className="rounded-2xl bg-secondary/10 p-4">
          <Select
            value={String(settings.streamWidth)}
            onValueChange={(value) => onUpdate({ streamWidth: Number(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="960">Oszczędny</SelectItem>
              <SelectItem value="1280">Zbalansowany</SelectItem>
              <SelectItem value="1600">Wyraźny</SelectItem>
              <SelectItem value="1920">Najostrzejszy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SliderRow
          title="Płynność"
          value={settings.streamFps}
          display={smoothnessLabel(settings.streamFps)}
          min={1}
          max={30}
          step={1}
          onCommit={(streamFps) => onUpdate({ streamFps })}
        />

        <SliderRow
          title="Jakość"
          value={settings.jpegQuality}
          display={qualityLabel(settings.jpegQuality)}
          min={30}
          max={90}
          step={2}
          onCommit={(jpegQuality) => onUpdate({ jpegQuality })}
        />
      </Section>
    </div>
  );
}
