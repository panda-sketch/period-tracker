import { useState } from 'preact/hooks';
import type { ISODate } from '../domain/dates';
import { BUILTIN_SYMPTOMS, FLOWS, MOODS, type DayLog, type TrackerData } from '../domain/types';
import { capitalize, fmtLong } from './format';

interface Props {
  date: ISODate;
  data: TrackerData;
  onChange: (log: DayLog) => void;
  onAddSymptom: (name: string) => void;
  onClose: () => void;
}

export function DayEditor({ date, data, onChange, onAddSymptom, onClose }: Props) {
  const log: DayLog = data.days[date] ?? { date, symptoms: [] };
  const [newTag, setNewTag] = useState('');
  const [note, setNote] = useState(log.note ?? '');
  const symptoms = [...BUILTIN_SYMPTOMS, ...data.customSymptoms];

  const update = (patch: Partial<DayLog>) => onChange({ ...log, ...patch });

  function toggleSymptom(s: string) {
    const has = log.symptoms.includes(s);
    update({ symptoms: has ? log.symptoms.filter((x) => x !== s) : [...log.symptoms, s] });
  }

  function addTag(e: Event) {
    e.preventDefault();
    const tag = newTag.trim().toLowerCase().slice(0, 40);
    if (!tag) return;
    if (!symptoms.includes(tag)) onAddSymptom(tag);
    if (!log.symptoms.includes(tag)) update({ symptoms: [...log.symptoms, tag] });
    setNewTag('');
  }

  return (
    <section class="screen editor" aria-label={`Log for ${fmtLong(date)}`}>
      <header class="editor-head">
        <button type="button" class="link" onClick={onClose}>
          ‹ Done
        </button>
        <h2>{fmtLong(date)}</h2>
      </header>

      <fieldset>
        <legend>Flow</legend>
        <div class="chips">
          <Chip label="None" on={!log.flow} onClick={() => update({ flow: undefined })} />
          {FLOWS.map((f) => (
            <Chip label={capitalize(f)} on={log.flow === f} onClick={() => update({ flow: f })} />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Symptoms</legend>
        <div class="chips">
          {symptoms.map((s) => (
            <Chip label={capitalize(s)} on={log.symptoms.includes(s)} onClick={() => toggleSymptom(s)} />
          ))}
        </div>
        <form class="add-tag" onSubmit={addTag}>
          <input
            type="text"
            placeholder="Add your own"
            aria-label="New symptom"
            value={newTag}
            maxLength={40}
            onInput={(e) => setNewTag(e.currentTarget.value)}
          />
          <button type="submit" class="secondary">
            Add
          </button>
        </form>
      </fieldset>

      <fieldset>
        <legend>Mood</legend>
        <div class="chips">
          {MOODS.map((m) => (
            <Chip
              label={capitalize(m)}
              on={log.mood === m}
              onClick={() => update({ mood: log.mood === m ? undefined : m })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Note</legend>
        <textarea
          rows={4}
          maxLength={2000}
          aria-label="Note"
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
          onBlur={() => note !== (log.note ?? '') && update({ note: note || undefined })}
        />
      </fieldset>

      <button
        type="button"
        class="primary"
        onClick={() => {
          if (note !== (log.note ?? '')) update({ note: note || undefined });
          onClose();
        }}
      >
        Save
      </button>
    </section>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" class={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
}
