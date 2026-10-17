# Period Tracker: Inception

AI-DLC phase: **Inception** (awaiting approval before Construction)
Date: 2026-10-16

## 1. Intent

A personal menstrual cycle tracker that never shares data with any third party. The owner is the only user, and the data lives only on the owner's own device.

## 2. Requirements

### Functional

| ID | Requirement |
|----|-------------|
| FR-1 | Log period start and end dates, with flow per day (spotting, light, medium, heavy). |
| FR-2 | Log daily symptoms (cramps, headache, bloating, acne, breast tenderness, fatigue, nausea, back pain), mood, and a free-text note. |
| FR-3 | Calendar view showing logged period days, predicted period days, and estimated fertile window. |
| FR-4 | Predict the next period start from the average of recent cycle lengths (last 6 cycles, default 28 days when fewer than 2 cycles exist). |
| FR-5 | Estimate ovulation (predicted next start minus 14 days) and a fertile window (ovulation minus 5 days through ovulation plus 1). Shown as an estimate, never as contraception. |
| FR-6 | Stats: average cycle length, average period length, shortest/longest cycle, and a cycle history list. |
| FR-7 | Edit and delete any entry. |
| FR-8 | Export all data to a file (JSON, encrypted if a passphrase is set) and import it back. |
| FR-9 | Optional passphrase lock: data encrypted at rest; the app asks for the passphrase on open. |
| FR-10 | "Delete all data" with confirmation. |

### Non-functional

| ID | Requirement |
|----|-------------|
| NFR-1 Privacy | Zero network calls after install. No analytics, telemetry, crash reporting, accounts, cloud sync, external fonts, or CDNs. Enforced by a strict Content-Security-Policy (`connect-src 'none'`) and a test that fails on any outbound request. |
| NFR-2 Local storage | Data stored only on-device in IndexedDB. |
| NFR-3 Encryption | When a passphrase is set: AES-GCM 256 with a key derived via PBKDF2-SHA-256 (600k iterations), Web Crypto API only. The passphrase is never stored; a forgotten passphrase means the data cannot be recovered. |
| NFR-4 Offline | Works fully offline; installable to the phone home screen as a PWA. |
| NFR-5 Platform | Mobile-first UI; works on current iOS Safari, Android Chrome, and desktop browsers. |
| NFR-6 Accessibility | WCAG 2.1 AA: keyboard reachable, labelled controls, not relying on color alone in the calendar. |
| NFR-7 Auditability | Small codebase with few dependencies, all bundled at build time, so the "no sharing" claim can be checked by reading the code. |

### Out of scope (v1)

Cloud sync, multiple users, push notifications (need a server or OS-specific setup), pregnancy mode, health-app integrations, native app store builds.

## 3. User stories

**Logging**
- US-1: As the owner, I can tap "Period started" today (or pick a past date) so a new cycle begins. *Accept:* a cycle is created; calendar marks the day.
- US-2: As the owner, I can mark the period as ended, or the app ends it automatically after 7 days with no flow logged. *Accept:* period length is computed.
- US-3: As the owner, I can open any day and log flow, symptoms, mood, and a note. *Accept:* saved instantly, visible on revisiting the day.
- US-4: As the owner, I can edit or delete any logged day. *Accept:* predictions and stats recompute.

**Insights**
- US-5: As the owner, I see "Next period in N days" on the home screen. *Accept:* matches FR-4; says "Log 2 cycles for better predictions" until enough data.
- US-6: As the owner, I see predicted period days and the fertile window on the calendar, styled differently from logged days. *Accept:* distinct pattern plus color; legend present.
- US-7: As the owner, I can view my cycle stats and history. *Accept:* values match FR-6.

**Privacy and data**
- US-8: As the owner, I can set, change, or remove a passphrase. *Accept:* with a passphrase set, IndexedDB contains only ciphertext.
- US-9: As the owner, I can export a backup file and import it on a new device. *Accept:* round-trip preserves every entry.
- US-10: As the owner, I can wipe all data. *Accept:* storage is empty afterwards.
- US-11: As the owner, I can install the app and use it in airplane mode. *Accept:* all features work offline.

## 4. Units of work

| Unit | Contents | Depends on |
|------|----------|------------|
| U1 Domain core | Data model (Cycle, DayLog, Settings), cycle/prediction/stats logic as pure functions | none |
| U2 Storage and crypto | IndexedDB repository, Web Crypto encryption, export/import | U1 |
| U3 UI | Home (countdown), Calendar, Day log, Stats, Settings screens | U1, U2 |
| U4 PWA shell | Manifest, service worker for offline, CSP, icons | U3 |

Construction order: U1, U2, U3, U4, each with its own tests.

## 5. Proposed stack

- **TypeScript + Vite**, building to plain static files.
- **Preact** (3 KB) for the UI, or no framework at all; Preact keeps the code small and readable.
- **idb** (tiny IndexedDB wrapper) as the only runtime dependency besides Preact.
- **Web Crypto API** built into the browser for encryption; no crypto library.
- **vite-plugin-pwa** at build time for the service worker and manifest.
- **Vitest** for domain and storage tests (with fake-indexeddb), **Playwright** for end-to-end tests including the "no network requests" check.
- **Hosting:** any static host or run locally. Because there is no backend, the host only serves files; your data never leaves the phone. Options: GitHub Pages (needs a repo), or serve from your computer on your home Wi-Fi once and install.

## 6. Open questions (defaults in bold)

1. Passphrase lock: **optional, off by default** / always required
2. Symptom list: **the 8 listed in FR-2, plus custom tags** / fixed list only
3. Where the code lives: **this project folder for now, GitHub repo later** / a GitHub repo now
4. Hosting: **GitHub Pages** / self-hosted / decide later
