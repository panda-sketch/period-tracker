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

The phone needs to load the app once over HTTPS (browsers only allow installable offline apps on secure sites). Hosting is still to be decided; see `aidlc-docs/aidlc-state.md`. The host only serves the app's files; your logged data never goes to it.

## Layout

- `src/domain` cycle, prediction and stats logic (pure functions)
- `src/storage` IndexedDB vault, PIN encryption, backup files
- `src/ui` screens
- `aidlc-docs` Inception and Construction records
