# Period Tracker: Construction design

AI-DLC phase: **Construction** (complete, awaiting review). Date: 2026-10-16.

## Decisions from Inception review
- Lock is an optional **5-digit PIN** (not a free-form passphrase).
- Symptoms: 8 built-ins plus custom tags. Code lives in this project folder. Hosting decided later.

## Domain model (U1, `src/domain/`)
- Data is one document: `{ version: 1, days: { 'YYYY-MM-DD': DayLog }, customSymptoms: [] }`.
- `DayLog`: optional flow (spotting, light, medium, heavy), symptoms, mood, note.
- Periods are **derived**, not stored: runs of light/medium/heavy days, allowing gaps of up to 2 days. Spotting never starts a period. This means "period ended" needs no button (US-2 is satisfied by simply not logging flow).
- Cycle length = days between consecutive period starts. Cycles outside 15 to 60 days are treated as missed logging and left out of averages.
- Prediction: mean of the last 6 valid cycles (28-day default until 2 exist). Ovulation = next start minus 14; fertile window = ovulation minus 5 to plus 1. A late period stays in the past ("3 days late") unless logging stopped more than 60 days ago.
- Dates are `YYYY-MM-DD` strings with UTC arithmetic so daylight-saving shifts never move a day.

## Storage and security (U2, `src/storage/`)
- One IndexedDB database `period-tracker`, store `kv`, keys `meta` and `data`. No other storage is used.
- No PIN: data stored as plain JSON on the device.
- PIN set: PBKDF2-SHA-256 (1,000,000 iterations, random 16-byte salt) derives an AES-GCM-256 key; the whole document is re-encrypted with a fresh 12-byte IV on every save. The PIN and key are never stored. GCM authentication doubles as PIN verification.
- Wrong PIN: 5 free attempts, then a lockout of 30 s doubling per further miss (max 1 h), persisted across restarts. The app also re-locks after 60 s in the background.
- **Known limit:** a 5-digit PIN has 100,000 combinations. The UI lockout stops guessing in the app, but someone who copies the raw browser storage off an unlocked device could brute-force it offline (roughly hours of compute at 1M iterations). It protects well against a person picking up your phone; it is not strong against a forensic attacker. A longer PIN would fix this if ever wanted.
- Backups: JSON file `period-tracker-backup-<date>.json`, encrypted with the same scheme when a PIN is set. Restore replaces all data after confirmation. All input is validated and malformed entries are dropped.

## UI (U3, `src/ui/`)
Preact, 4 tabs: Today (cycle day, countdown, next fertile window), Calendar (logged, predicted, fertile and ovulation days with shape as well as color, notes dot), Stats (averages, shortest/longest, history), Settings (PIN, backup, custom symptoms, privacy note, delete all). Day editor saves on every tap. Light and dark themes; 44px touch targets; labelled controls.

## PWA and privacy enforcement (U4)
- Build injects a Content-Security-Policy: `default-src 'none'`, `connect-src 'none'`, own scripts/styles only. The browser itself blocks any fetch, XHR, WebSocket or beacon.
- No external fonts, CDNs, analytics or trackers. Only runtime dependency: Preact (bundled).
- Generated `sw.js` caches only the app's own files and ignores other origins. Manifest + icons make it installable.
- `navigator.storage.persist()` asks the browser not to evict the data.

## Tests
- Unit (Vitest, 28): dates, period grouping, predictions, stats, fertile window; vault encryption at rest, wrong PIN and lockout, PIN change/removal, wipe; backup round-trips and validation.
- End-to-end (Playwright, 5, mobile viewport): logging and persistence, offline after install, PIN lock with ciphertext check, backup/delete/restore, and CSP blocking a real network call. Every e2e test also fails if any request leaves the app's own origin.

## FR-11 Period reminder (added 2026-10-17)
- Option A from `inception-fr11-reminder.md`: a calendar event plus an in-app banner. No server, no push service, CSP unchanged.
- `src/domain/reminder.ts`: reminder date = predicted start minus `daysBefore` (default 5, range 1 to 14). The banner shows from that date until the predicted start, unless the period is already logged. `calendarOutOfDate` is true when a reminder was added but the upcoming reminder date differs, which covers both a shifted prediction and a new cycle.
- `buildICS` writes one all-day event with a 9:00 alert (`TRIGGER;RELATED=START:PT9H`), neutral title (default "Reminder", editable, 60 chars max), fixed UID so calendars that support it replace the old event. CRLF line endings, escaped text.
- Settings stores `reminder: { enabled, daysBefore, title, exportedFor }` inside the tracker data, so it is encrypted with the PIN and included in backups. Older data without it gets the defaults.
- Today shows "Reminder: your period is coming soon." in the window, and "Your next reminder date is now X. Update calendar" when the calendar copy is stale.
- Limit: the phone's calendar app owns the alert. If that calendar syncs to iCloud or Google, the event title and date are stored there; the UI says so. Opening a downloaded `.ics` from an installed iPhone web app still needs a check on a real device during Operations.
- Tests: 6 unit tests (dates, banner window, stale detection, ICS content and escaping, validation) and 1 browser test (banner, `.ics` download content, update prompt, no outside requests).
