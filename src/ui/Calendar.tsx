import { useState } from 'preact/hooks';
import { forecast, predict } from '../domain/cycles';
import { diffDays, monthGrid, parseISO, type ISODate } from '../domain/dates';
import type { TrackerData } from '../domain/types';
import { fmtLong, fmtMonth } from './format';

interface Props {
  data: TrackerData;
  todayISO: ISODate;
  onOpenDay: (d: ISODate) => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function Calendar({ data, todayISO, onOpenDay }: Props) {
  const t = parseISO(todayISO);
  const [ym, setYm] = useState({ y: t.getUTCFullYear(), m: t.getUTCMonth() });
  const p = predict(data, todayISO);
  const marks = p ? forecast(p, 3) : new Map();

  function shift(n: number) {
    const d = new Date(Date.UTC(ym.y, ym.m + n, 1));
    setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }

  return (
    <section class="screen calendar">
      <header class="month-nav">
        <button type="button" class="icon" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <h2>{fmtMonth(ym.y, ym.m)}</h2>
        <button type="button" class="icon" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
      </header>
      <div class="grid" role="grid">
        {WEEKDAYS.map((w) => (
          <div class="weekday" role="columnheader">
            {w}
          </div>
        ))}
        {monthGrid(ym.y, ym.m).map((d) => {
          if (!d) return <div class="cell empty" />;
          const log = data.days[d];
          const future = diffDays(todayISO, d) > 0;
          const classes = ['cell'];
          const labels: string[] = [];
          if (log?.flow === 'spotting') {
            classes.push('spotting');
            labels.push('spotting');
          } else if (log?.flow) {
            classes.push('period', log.flow);
            labels.push(`period, ${log.flow} flow`);
          } else if (future || diffDays(todayISO, d) === 0) {
            const k = marks.get(d);
            if (k) {
              classes.push(k);
              labels.push(k === 'predicted-period' ? 'predicted period' : k === 'ovulation' ? 'estimated ovulation' : 'fertile window');
            }
          }
          if (d === todayISO) {
            classes.push('today');
            labels.push('today');
          }
          const hasNotes = !!log && (log.symptoms.length > 0 || !!log.mood || !!log.note);
          if (hasNotes) labels.push('has notes');
          return (
            <button
              type="button"
              class={classes.join(' ')}
              disabled={future}
              onClick={() => onOpenDay(d)}
              aria-label={`${fmtLong(d)}${labels.length ? ', ' + labels.join(', ') : ''}`}
            >
              <span class="num">{Number(d.slice(8))}</span>
              {hasNotes && <span class="note-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <ul class="legend">
        <li>
          <span class="swatch period" /> Period
        </li>
        <li>
          <span class="swatch predicted-period" /> Predicted
        </li>
        <li>
          <span class="swatch fertile" /> Fertile
        </li>
        <li>
          <span class="swatch ovulation" /> Ovulation
        </li>
        <li>
          <span class="swatch notes">
            <span class="note-dot" />
          </span>{' '}
          Notes
        </li>
      </ul>
    </section>
  );
}
