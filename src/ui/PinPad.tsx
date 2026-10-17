import { useEffect, useState } from 'preact/hooks';

interface Props {
  title: string;
  message?: string;
  error?: string;
  busy?: boolean;
  disabled?: boolean;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export function PinPad({ title, message, error, busy, disabled, onComplete, onCancel }: Props) {
  const [pin, setPin] = useState('');

  // Clear the dots after a failed attempt.
  useEffect(() => {
    if (error) setPin('');
  }, [error]);

  function press(k: string) {
    if (busy || disabled) return;
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    if (!/^\d$/.test(k) || pin.length >= 5) return;
    const next = pin + k;
    if (next.length < 5) return setPin(next);
    setPin('');
    onComplete(next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Escape' && onCancel) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div class="pinpad" role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {message && <p class="muted">{message}</p>}
      <div class="dots" aria-label={`${pin.length} of 5 digits entered`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span class={i < pin.length ? 'dot on' : 'dot'} />
        ))}
      </div>
      <p class="error" role="alert">
        {busy ? 'Checking…' : error ?? ' '}
      </p>
      <div class="keys">
        {KEYS.map((k) =>
          k ? (
            <button
              type="button"
              class="key"
              onClick={() => press(k)}
              disabled={busy || disabled}
              aria-label={k === '⌫' ? 'Delete digit' : k}
            >
              {k}
            </button>
          ) : (
            <span />
          ),
        )}
      </div>
      {onCancel && (
        <button type="button" class="link" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

/** Asks for a new PIN twice and reports it once both entries match. */
export function NewPin({ onDone, onCancel }: { onDone: (pin: string) => void; onCancel: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  return first === null ? (
    <PinPad
      key="first"
      title="Choose a 5-digit PIN"
      message="If you forget it, your data cannot be recovered."
      error={error}
      onComplete={(p) => {
        setError(undefined);
        setFirst(p);
      }}
      onCancel={onCancel}
    />
  ) : (
    <PinPad
      key="second"
      title="Enter the PIN again"
      onComplete={(p) => {
        if (p === first) onDone(p);
        else {
          setFirst(null);
          setError("The PINs didn't match. Try again.");
        }
      }}
      onCancel={onCancel}
    />
  );
}
