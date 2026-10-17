import { useEffect, useRef, useState } from 'preact/hooks';
import { today, type ISODate } from '../domain/dates';
import { emptyData, isEmptyLog, type DayLog, type TrackerData } from '../domain/types';
import { LockedOutError, Vault, WrongPinError } from '../storage/vault';
import { predict } from '../domain/cycles';
import { buildICS, reminderDate } from '../domain/reminder';
import { Calendar } from './Calendar';
import { saveFile } from './download';
import { fmtShort } from './format';
import { DayEditor } from './DayEditor';
import { PinPad } from './PinPad';
import { Settings } from './Settings';
import { Stats } from './Stats';
import { Today } from './Today';

type Tab = 'today' | 'calendar' | 'stats' | 'settings';
type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'locked' } | { kind: 'ready' };

/** Lock again when the app has been in the background this long. */
const AUTO_LOCK_MS = 60_000;

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [data, setData] = useState<TrackerData>(emptyData());
  const [tab, setTab] = useState<Tab>('today');
  const [editing, setEditing] = useState<ISODate | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, tick] = useState(0);
  const vault = useRef<Vault | null>(null);
  const sessionPin = useRef<string | null>(null);
  const todayISO = today();

  useEffect(() => {
    (async () => {
      try {
        const v = await Vault.open();
        vault.current = v;
        // Ask the browser not to evict our storage under pressure.
        navigator.storage?.persist?.().catch(() => {});
        const d = await v.loadUnlocked();
        if (d) {
          setData(d);
          setPhase({ kind: 'ready' });
        } else {
          setLockedUntil(v.lockedUntil);
          setPhase({ kind: 'locked' });
        }
      } catch (e) {
        setPhase({ kind: 'error', message: (e as Error).message });
      }
    })();
  }, []);

  // Auto-lock after the app has been hidden for a while.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (vault.current?.hasPin && hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) lock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Count down a PIN lockout.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

  function lock() {
    vault.current?.lock();
    sessionPin.current = null;
    setData(emptyData());
    setEditing(null);
    setPinError(undefined);
    setLockedUntil(vault.current?.lockedUntil ?? 0);
    setPhase({ kind: 'locked' });
  }

  // Several edits can land before a re-render (adding a tag also selects it),
  // so changes are applied to the latest data rather than a render's snapshot.
  const latest = useRef(data);
  latest.current = data;

  async function commit(change: TrackerData | ((d: TrackerData) => TrackerData)) {
    const next = typeof change === 'function' ? change(latest.current) : change;
    latest.current = next;
    setData(next);
    try {
      await vault.current!.save(next);
    } catch (e) {
      notify(`Could not save: ${(e as Error).message}`);
    }
  }

  function saveDay(log: DayLog) {
    commit((d) => {
      const days = { ...d.days };
      if (isEmptyLog(log)) delete days[log.date];
      else days[log.date] = log;
      return { ...d, days };
    });
  }

  /** FR-11: hands the phone's calendar an event with an alert, then remembers its date. */
  function addReminder() {
    const p = predict(latest.current, todayISO);
    if (!p) return;
    const date = reminderDate(p, latest.current.reminder);
    saveFile(buildICS(date, latest.current.reminder.title), 'reminder.ics', 'text/calendar');
    commit((d) => ({ ...d, reminder: { ...d.reminder, exportedFor: date } }));
    notify(`Open the file to add the ${fmtShort(date)} reminder to your calendar.`);
  }

  async function unlock(pin: string) {
    setBusy(true);
    try {
      const d = await vault.current!.unlock(pin);
      sessionPin.current = pin;
      setData(d);
      setPinError(undefined);
      setPhase({ kind: 'ready' });
    } catch (e) {
      if (e instanceof WrongPinError || e instanceof LockedOutError) setLockedUntil(e.lockedUntil);
      setPinError(e instanceof LockedOutError ? 'Too many attempts.' : 'Wrong PIN.');
    } finally {
      setBusy(false);
    }
  }

  if (phase.kind === 'loading') return <main class="center muted">Loading…</main>;
  if (phase.kind === 'error')
    return (
      <main class="center">
        <p>This browser could not open on-device storage, so the tracker cannot run here.</p>
        <p class="muted small">{phase.message}</p>
      </main>
    );
  if (phase.kind === 'locked') {
    const wait = Math.ceil((lockedUntil - Date.now()) / 1000);
    return (
      <main class="center">
        <PinPad
          title="Enter your PIN"
          error={wait > 0 ? `Too many attempts. Try again in ${wait}s.` : pinError}
          busy={busy}
          disabled={wait > 0}
          onComplete={unlock}
        />
      </main>
    );
  }

  return (
    <>
      <main>
        {editing ? (
          <DayEditor
            date={editing}
            data={data}
            onChange={saveDay}
            onAddSymptom={(s) => commit((d) => ({ ...d, customSymptoms: [...d.customSymptoms, s] }))}
            onClose={() => setEditing(null)}
          />
        ) : tab === 'today' ? (
          <Today
            data={data}
            todayISO={todayISO}
            onOpenDay={setEditing}
            onAddReminder={addReminder}
            onStartPeriod={() =>
              saveDay({ ...(data.days[todayISO] ?? { date: todayISO, symptoms: [] }), flow: 'medium' })
            }
          />
        ) : tab === 'calendar' ? (
          <Calendar data={data} todayISO={todayISO} onOpenDay={setEditing} />
        ) : tab === 'stats' ? (
          <Stats data={data} />
        ) : (
          <Settings
            data={data}
            onAddReminder={addReminder}
            onUpdateReminder={(patch) => commit((d) => ({ ...d, reminder: { ...d.reminder, ...patch } }))}
            hasPin={!!vault.current?.hasPin}
            todayISO={todayISO}
            sessionPin={sessionPin.current}
            notify={notify}
            onLock={lock}
            onSetPin={async (pin) => {
              await vault.current!.setPin(pin, data);
              sessionPin.current = pin;
            }}
            onRemovePin={async () => {
              await vault.current!.removePin(data);
              sessionPin.current = null;
              tick((n) => n + 1);
            }}
            onReplaceData={commit}
            onRemoveSymptom={(s) => commit((d) => ({ ...d, customSymptoms: d.customSymptoms.filter((x) => x !== s) }))}
            onWipe={async () => {
              await vault.current!.wipe();
              sessionPin.current = null;
              setData(emptyData());
            }}
          />
        )}
      </main>
      {!editing && (
        <nav class="tabs" aria-label="Sections">
          {(
            [
              ['today', 'Today', <circle cx="12" cy="12" r="7" />],
              ['calendar', 'Calendar', <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>],
              ['stats', 'Stats', <path d="M5 20V12M12 20V5M19 20v-9" />],
              ['settings', 'Settings', <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              type="button"
              class={tab === id ? 'tab on' : 'tab'}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
                {icon}
              </svg>
              {label}
            </button>
          ))}
        </nav>
      )}
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
