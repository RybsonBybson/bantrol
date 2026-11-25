# Bantrol

Bantrol zamienia telefon w pilot do komputera. Podgląd ekranu, kursor, kliknięcia, przewijanie i klawiatura działają w domowej sieci — bez konta, chmury i konfiguracji.

Repozytorium zawiera trzy części:

| Katalog | Co to jest |
| --- | --- |
| `src/` + `src-tauri/` | Aplikacja desktopowa (Tauri + React) |
| `mobile/` + `mobile/src-tauri/` | Aplikacja mobilna (Tauri + React, Android/iOS) |
| `front/` | Strona marketingowa z inteligentnym przyciskiem pobierania |

## Wymagania

- Node.js 22+
- Rust (stable)
- Na Windows: WebView2
- Do budowy Androida: Android SDK, NDK 27, Java 17

## Uruchomienie

```bash
npm install
npm run tauri dev
```

Strona marketingowa:

```bash
cd front
npm install
npm run dev
```

Aplikacja mobilna (podgląd w przeglądarce):

```bash
cd mobile
npm install
npm run dev
```

## Budowanie

Desktop:

```bash
npm run build
npm run tauri build
```

> Pełny `tauri build` tworzy podpisane aktualizacje, więc potrzebuje zmiennych `TAURI_SIGNING_PRIVATE_KEY` i `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (patrz sekcja „Aktualizacje”). Sam podgląd bez pakowania (`npm run tauri dev`) nie wymaga klucza.

Mobile (Android):

```bash
cd mobile
npm run build
npm run tauri android init
npm run tauri android build -- --apk
```

Strona:

```bash
cd front
npm run build
```

## Połączenie

1. Uruchom Bantrola na komputerze i włącz połączenie.
2. Otwórz Bantrola na telefonie.
3. Zeskanuj kod QR z ekranu komputera.

Połączenie działa wyłącznie między aplikacją desktopową a aplikacją mobilną. Serwer nie udostępnia webowego pilota w przeglądarce.

## Aktualizacje

Aplikacja desktopowa sprawdza aktualizacje po uruchomieniu i instaluje je w tle. Wydania są podpisywane kluczem, którego para została już wygenerowana:

- klucz publiczny jest wpisany w `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`),
- klucz prywatny leży w `src-tauri/bantrol.key` (poza repozytorium) z hasłem `bantrol`.

> Dla własnego wydania zmień hasło i wygeneruj nową parę: `npm run tauri signer generate -- -w src-tauri/bantrol.key`.

Dodaj w GitHubie dwa sekrety (Settings → Secrets and variables → Actions):

- `TAURI_SIGNING_PRIVATE_KEY` — zawartość pliku `src-tauri/bantrol.key`,
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — hasło klucza (tu: `bantrol`).

Aplikacja mobilna sprawdza najnowsze wydanie i prowadzi do aktualizacji przez mechanizm systemowy Androida.

## Wydania

Workflow `.github/workflows/release.yml` uruchamia się przy pushu do `main`, tagu `v*` lub ręcznie. Buduje:

- instalatory desktopowe (Windows, Linux, macOS),
- APK na Androida,
- stronę marketingową.

Artefakty trafiają do GitHub Releases. Przycisk „Pobierz” na stronie wykrywa system i pobiera właściwy plik z najnowszego wydania, a w razie braku wydania prowadzi do listy wersji.

## Wygląd

- Paleta: Dusk Blue `#3D5A80`, Powder Blue `#98C1D9`, Light Cyan `#E0FBFC`, Burnt Peach `#EE6C4D`, Ink Black `#181D26`.
- Fonty wyłącznie z `public/fonts` (Caladea).
- Tryb jasny, ciemny i systemowy w każdej części aplikacji.
- Logo: `public/bantrol-logo.svg`.
