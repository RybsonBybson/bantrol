import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Keyboard,
  MonitorPlay,
  Moon,
  MousePointerClick,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sun,
  Wifi,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fallbackTarget,
  resolveDownload,
  RELEASES_PAGE,
  type DownloadTarget,
} from "@/lib/releases";

const features = [
  {
    icon: MonitorPlay,
    title: "Ekran jak na dłoni",
    text: "Zobacz pulpit komputera na telefonie od razu. Płynnie, wyraźnie i bez czekania.",
    tags: ["natychmiastowy podgląd", "płynnie", "czytelnie"],
    tone: "card",
  },
  {
    icon: MousePointerClick,
    title: "Pełna kontrola",
    text: "Przesuwaj kursor, klikaj, przewijaj i pisz z telefonu. Wszystko działa tak, jakbyś siedział przy komputerze.",
    tags: ["kursor", "kliknięcia", "klawiatura"],
    tone: "secondary",
  },
  {
    icon: ShieldCheck,
    title: "Prywatność z definicji",
    text: "Obraz i dane zostają między Twoimi urządzeniami. Bez konta, chmury i wysyłania czegokolwiek na zewnątrz.",
    tags: ["tylko Twoje urządzenia", "kod parowania", "bez konta"],
    tone: "primary",
  },
] as const;

const steps = [
  {
    title: "Zainstaluj Bantrola",
    text: "Pobierz aplikację na komputer i uruchom ją. Od razu będzie gotowa na telefon.",
  },
  {
    title: "Połącz telefon",
    text: "Zainstaluj Bantrola na telefonie i zeskanuj kod QR z ekranu komputera.",
  },
  {
    title: "Steruj bezprzewodowo",
    text: "Dotykaj ekranu, aby klikać, przeciągaj, aby przesuwać kursor, i pisz z klawiatury.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.07,
      duration: 0.5,
      ease: "easeOut" as const,
    },
  }),
};

function useSiteTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("bantrol.site.theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("bantrol.site.theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((value) => !value) };
}

function useDownloadTarget() {
  const [target, setTarget] = useState<DownloadTarget>(fallbackTarget);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    resolveDownload().then((resolved) => {
      if (!alive) return;
      setTarget(resolved);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { target, loading };
}

function DownloadLink({
  target,
  loading,
  className,
  children,
}: {
  target: DownloadTarget;
  loading: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={target.url}
      download={target.fromRelease || undefined}
      target={target.fromRelease ? undefined : "_blank"}
      rel={target.fromRelease ? undefined : "noreferrer"}
      className={className}
      aria-busy={loading}
    >
      {children ?? (
        <>
          <Download className="size-4.5" />
          {loading ? "Przygotowujemy pobieranie…" : target.label}
        </>
      )}
    </a>
  );
}

export default function App() {
  const { dark, toggle } = useSiteTheme();
  const { target, loading } = useDownloadTarget();
  const reduce = useReducedMotion();

  const motionProps = (index: number) =>
    reduce
      ? {}
      : {
          variants: fadeUp,
          initial: "hidden" as const,
          whileInView: "show" as const,
          viewport: { once: true, margin: "-60px" },
          custom: index,
        };

  return (
    <div className="min-h-full">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <a href="#top" className="flex items-center gap-3">
          <motion.img
            src="/bantrol-logo.svg"
            alt="Logo Bantrol"
            className="size-10"
            whileHover={reduce ? undefined : { rotate: -6, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          />
          <span className="text-xl font-bold tracking-tight">Bantrol</span>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground sm:flex">
          <a className="transition-colors hover:text-foreground" href="#mozliwosci">
            Możliwości
          </a>
          <a className="transition-colors hover:text-foreground" href="#bezpieczenstwo">
            Bezpieczeństwo
          </a>
          <a className="transition-colors hover:text-foreground" href="#pobierz">
            Pobierz
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={dark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
            className="bg-card hover:bg-secondary/25"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="#pobierz">
              Pobierz
              <ArrowRight className="size-3.5" />
            </a>
          </Button>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-20 pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pb-28 lg:pt-14">
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 24 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <Badge variant="muted" className="gap-2 px-3.5 py-1.5">
              <span className="size-1.5 rounded-full bg-accent" />
              Bez chmury · Bez konta
            </Badge>

            <h1 className="mt-6 text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl xl:text-[4.4rem]">
              Twój komputer
              <br />
              na wyciągnięcie{" "}
              <span className="text-accent">kciuka</span>.
            </h1>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Bantrol zamienia telefon w pilot do komputera. Podgląd ekranu,
              kursor, kliknięcia i klawiatura — w Twojej domowej sieci, bez
              konta i bez chmury.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="accent" size="lg">
                <DownloadLink target={target} loading={loading} />
              </Button>
              <Button asChild variant="subtle" size="lg">
                <a href="#mozliwosci">
                  Zobacz możliwości
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5" />
                Windows, macOS i Linux
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5" />
                Bez konta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5" />
                Polski interfejs
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={reduce ? undefined : { opacity: 0, scale: 0.96, y: 20 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
            className="relative mx-auto w-full max-w-md pb-10 lg:max-w-none"
          >
            <div className="relative overflow-hidden rounded-[2.75rem] bg-primary p-5 text-primary-foreground sm:p-7">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -bottom-14 size-56 bg-background/10"
                style={{
                  maskImage: "url(/bantrol-logo.svg)",
                  WebkitMaskImage: "url(/bantrol-logo.svg)",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />

              <div className="relative flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold">
                  <span className="size-1.5 rounded-full bg-accent" />
                  Podgląd na żywo
                </span>
                <span className="rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold">
                  Twój ekran
                </span>
              </div>

              <div className="relative mt-6 rounded-3xl bg-background p-3">
                <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-card p-4">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-accent" />
                    <span className="size-2 rounded-full bg-secondary" />
                    <span className="size-2 rounded-full bg-primary/50" />
                    <span className="ml-2 h-2 w-20 rounded-full bg-secondary/40" />
                  </div>

                  <div className="mt-4 grid h-[calc(100%-1.75rem)] grid-cols-[0.9fr_1.1fr] gap-3">
                    <div className="rounded-xl bg-primary p-3 text-primary-foreground">
                      <div className="h-2 w-10 rounded-full bg-background/50" />
                      <div className="mt-2 h-2 w-14 rounded-full bg-background/25" />
                      <div className="mt-4 space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-background/20" />
                        <div className="h-1.5 w-4/5 rounded-full bg-background/20" />
                        <div className="h-1.5 w-2/3 rounded-full bg-background/20" />
                      </div>
                      <div className="mt-4 h-6 w-16 rounded-lg bg-accent" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex-1 rounded-xl bg-secondary/35 p-3">
                        <div className="h-2 w-16 rounded-full bg-primary/40" />
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          <div className="h-8 rounded-lg bg-card" />
                          <div className="h-8 rounded-lg bg-card" />
                          <div className="h-8 rounded-lg bg-card" />
                        </div>
                      </div>
                      <div className="h-10 rounded-xl bg-secondary/20" />
                    </div>
                  </div>
                </div>

                <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-secondary/50" />
              </div>

              <div className="absolute bottom-4 right-4 w-40 rounded-3xl bg-card p-4 text-card-foreground sm:right-6">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                  <Smartphone className="size-3.5" />
                  Kod parowania
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-[0.18em]">
                  482913
                </p>
                <div className="mt-3 flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
                  <span className="size-1 rounded-full bg-accent" />
                  Połączono
                </div>
              </div>
            </div>

            <p className="mt-7 text-center text-xs text-muted-foreground">
              Podgląd poglądowy. Obraz zostaje między komputerem a telefonem.
            </p>
          </motion.div>
        </section>

        <section id="mozliwosci" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Możliwości
              </p>
              <h2 className="mt-3 max-w-xl text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl">
                Wszystko, czego potrzebujesz.
                <br />
                Nic, czego nie chcesz.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Bez konfiguracji sieci i bez kont. Wystarczy Bantrol na komputerze
              i telefonie.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const toneClass =
                feature.tone === "primary"
                  ? "bg-primary text-primary-foreground"
                  : feature.tone === "secondary"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-card text-card-foreground";
              return (
                <motion.div key={feature.title} {...motionProps(index)}>
                  <Card className={`${toneClass} h-full`}>
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-background/15">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold leading-tight">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed opacity-75">
                        {feature.text}
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {feature.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-background/15 px-2.5 py-1 text-[11px] font-semibold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section
          id="bezpieczenstwo"
          className="mx-auto w-full max-w-6xl px-6 py-10 md:py-16"
        >
          <motion.div
            {...motionProps(0)}
            className="rounded-[2.75rem] bg-card p-7 sm:p-10 md:p-14"
          >
            <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:gap-14">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Jak to działa
                </p>
                <h2 className="mt-3 text-4xl font-bold leading-[1.06] tracking-tight">
                  Trzy kroki.
                  <br />
                  Zero chmury.
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Bantrol łączy tylko Twoje urządzenia. Nie potrzebuje konta,
                  subskrypcji ani dostępu do internetu.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    <Wifi className="size-3.5" />
                    tylko Twoje urządzenia
                  </Badge>
                  <Badge variant="secondary">
                    <ScanLine className="size-3.5" />
                    kod parowania
                  </Badge>
                  <Badge variant="secondary">
                    <Keyboard className="size-3.5" />
                    pełne sterowanie
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.title}
                    {...motionProps(index + 1)}
                    className="flex gap-4 rounded-3xl bg-secondary/10 p-5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground tabular-nums">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="font-bold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {step.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section id="pobierz" className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
          <motion.div
            {...motionProps(0)}
            className="relative overflow-hidden rounded-[2.75rem] bg-primary px-7 py-12 text-primary-foreground sm:px-10 md:px-14 md:py-16"
          >
            <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-background/10" />
            <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                  Pobierz
                </p>
                <h2 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                  Zainstaluj i połącz telefon w minutę.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed opacity-75">
                  Bantrol wybierze właściwą wersję dla Twojego urządzenia.
                  Telefon połączysz kodem QR — bez kabli i konfiguracji.
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-stretch gap-2">
                <Button
                  asChild
                  size="lg"
                  className="bg-background text-foreground hover:bg-background/85"
                >
                  <DownloadLink target={target} loading={loading} />
                </Button>
                <span className="text-center text-xs opacity-70">
                  {target.version
                    ? `Wersja ${target.version} · ${target.hint}`
                    : target.hint}
                </span>
                <a
                  href={RELEASES_PAGE}
                  target="_blank"
                  rel="noreferrer"
                  className="text-center text-xs font-semibold underline-offset-4 opacity-70 transition-opacity hover:opacity-100 hover:underline"
                >
                  Wszystkie wersje i aplikacja mobilna
                </a>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10">
        <div className="flex flex-col gap-6 rounded-3xl bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/bantrol-logo.svg"
              alt="Logo Bantrol"
              className="size-9"
            />
            <div>
              <p className="text-sm font-bold">Bantrol</p>
              <p className="text-xs text-muted-foreground">
                Pilot komputera przez Wi-Fi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-muted-foreground">
            <a className="transition-colors hover:text-foreground" href="#mozliwosci">
              Możliwości
            </a>
            <a
              className="transition-colors hover:text-foreground"
              href="#bezpieczenstwo"
            >
              Bezpieczeństwo
            </a>
            <a className="transition-colors hover:text-foreground" href="#pobierz">
              Pobierz
            </a>
            <span className="text-muted-foreground/70">Bantrol · 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
