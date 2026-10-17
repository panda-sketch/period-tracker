# Cycle Tracker

A private period tracker. It runs entirely in your browser, stores data only on your device, and makes no network connections.

## Run it on your computer

Requires Node.js 20 or newer.

```sh
npm install
npm run build
npm run preview      # open http://localhost:4173
```

## Test

```sh
npm test             # unit tests
npx playwright install chromium   # once
npm run test:e2e     # browser tests, including the no-network check
```

## Install on a phone

The app is hosted on GitHub Pages at https://panda-sketch.github.io/period-tracker/ and redeploys on every push to `main` (`.github/workflows/pages.yml`). GitHub only serves the app's files; your logged data never leaves your device.

On iPhone: open the link in Safari, tap Share, then "Add to Home Screen". After the first load it works offline.

## Layout

- `src/domain` cycle, prediction and stats logic (pure functions)
- `src/storage` IndexedDB vault, PIN encryption, backup files
- `src/ui` screens
- `aidlc-docs` Inception and Construction records
