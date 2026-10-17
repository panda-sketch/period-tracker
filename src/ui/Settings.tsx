import { useState } from 'preact/hooks';
import type { ISODate } from '../domain/dates';
import type { TrackerData } from '../domain/types';
import { BackupNeedsPinError, backupFilename, makeBackup, readBackup } from '../storage/backup';
import { NewPin, PinPad } from './PinPad';

interface Props {
  data: TrackerData;
  hasPin: boolean;
  todayISO: ISODate;
  /** The PIN of the unlocked session, used to encrypt backups. */
  sessionPin: string | null;
  onSetPin: (pin: string) => Promise<void>;
  onRemovePin: () => Promise<void>;
  onLock: () => void;
  onReplaceData: (d: TrackerData) => Promise<void>;
  onRemoveSymptom: (s: string) => void;
  onWipe: () => Promise<void>;
  notify: (msg: string) => void;
}

type Mode = 'idle' | 'new-pin' | 'import-pin';

export function Settings(props: Props) {
  const { data, hasPin, notify } = props;
  const [mode, setMode] = useState<Mode>('idle');
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [importError, setImportError] = useState<string>();
  const [confirmWipe, setConfirmWipe] = useState(false);

  async function exportBackup() {
    const text = await makeBackup(data, props.sessionPin ?? undefined);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename(props.todayISO);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(props.sessionPin ? 'Backup saved, protected with your PIN.' : 'Backup saved.');
  }

  async function importText(text: string, pin?: string) {
    try {
      const d = await readBackup(text, pin);
      const n = Object.keys(d.days).length;
      if (!confirm(`Replace everything in this app with the backup (${n} logged days)?`)) return;
      await props.onReplaceData(d);
      setMode('idle');
      setPendingImport(null);
      notify('Backup restored.');
    } catch (e) {
      if (e instanceof BackupNeedsPinError) {
        setPendingImport(text);
        setImportError(undefined);
        setMode('import-pin');
      } else if (mode === 'import-pin') {
        setImportError((e as Error).message);
      } else {
        notify((e as Error).message);
      }
    }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await importText(await file.text());
  }

  if (mode === 'new-pin') {
    return (
      <section class="screen">
        <NewPin
          onCancel={() => setMode('idle')}
          onDone={async (pin) => {
            await props.onSetPin(pin);
            setMode('idle');
            notify('PIN set. Your data is now encrypted.');
          }}
        />
      </section>
    );
  }
  if (mode === 'import-pin' && pendingImport) {
    return (
      <section class="screen">
        <PinPad
          title="Enter the backup's PIN"
          message="This is the PIN that was set when the backup was made."
          error={importError}
          onComplete={(pin) => importText(pendingImport, pin)}
          onCancel={() => {
            setMode('idle');
            setPendingImport(null);
          }}
        />
      </section>
    );
  }

  return (
    <section class="screen settings">
      <h2>Settings</h2>

      <div class="card">
        <h3>PIN lock</h3>
        <p class="muted small">
          {hasPin
            ? 'On. Your data is encrypted on this device and the app asks for your PIN when opened.'
            : 'Off. Set a 5-digit PIN to encrypt your data and lock the app.'}
        </p>
        <div class="row">
          <button type="button" class="secondary" onClick={() => setMode('new-pin')}>
            {hasPin ? 'Change PIN' : 'Set PIN'}
          </button>
          {hasPin && (
            <>
              <button type="button" class="secondary" onClick={props.onLock}>
                Lock now
              </button>
              <button
                type="button"
                class="secondary"
                onClick={async () => {
                  if (!confirm('Remove the PIN? Your data will be stored unencrypted on this device.')) return;
                  await props.onRemovePin();
                  notify('PIN removed.');
                }}
              >
                Remove PIN
              </button>
            </>
          )}
        </div>
      </div>

      <div class="card">
        <h3>Backup</h3>
        <p class="muted small">
          Your data lives only in this app on this device. Deleting the app or clearing browser data erases it, so save a
          backup file now and then.
        </p>
        <div class="row">
          <button type="button" class="secondary" onClick={exportBackup}>
            Save backup file
          </button>
          <label class="button secondary">
            Restore from file
            <input type="file" accept="application/json,.json" onChange={onFile} hidden />
          </label>
        </div>
      </div>

      {data.customSymptoms.length > 0 && (
        <div class="card">
          <h3>Your symptoms</h3>
          <ul class="tag-list">
            {data.customSymptoms.map((s) => (
              <li>
                {s}
                <button type="button" class="link" aria-label={`Remove ${s}`} onClick={() => props.onRemoveSymptom(s)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div class="card">
        <h3>Privacy</h3>
        <p class="muted small">
          This app makes no network connections. There are no accounts, analytics, ads or cloud sync, and nothing you
          log leaves this device unless you save a backup file yourself.
        </p>
      </div>

      <div class="card danger">
        <h3>Delete all data</h3>
        {confirmWipe ? (
          <div class="row">
            <button
              type="button"
              class="danger-button"
              onClick={async () => {
                await props.onWipe();
                setConfirmWipe(false);
                notify('All data deleted.');
              }}
            >
              Yes, delete everything
            </button>
            <button type="button" class="secondary" onClick={() => setConfirmWipe(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" class="danger-button" onClick={() => setConfirmWipe(true)}>
            Delete all data
          </button>
        )}
      </div>
    </section>
  );
}
