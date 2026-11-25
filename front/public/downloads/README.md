# Pobieranie Bantrola

Przycisk „Pobierz Bantrol” na stronie wskazuje na plik:

```
/downloads/Bantrol-Setup.exe
```

Umieść w tym katalogu finalny instalator wygenerowany przez:

```bash
npm run tauri build
```

Plik instalatora znajdziesz w `src-tauri/target/release/bundle/nsis/`.
Zmień jego nazwę na `Bantrol-Setup.exe` i skopiuj do `front/public/downloads/`.
