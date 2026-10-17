import { cycleDay, predict, upcomingFertileWindow } from '../domain/cycles';
import { diffDays, type ISODate } from '../domain/dates';
import type { TrackerData } from '../domain/types';
import { fmtShort, plural } from './format';

interface Props {
  data: TrackerData;
  todayISO: ISODate;
  onStartPeriod: () => void;
  onOpenDay: (d: ISODate) => void;
}

export function Today({ data, todayISO, onStartPeriod, onOpenDay }: Props) {
  const p = predict(data, todayISO);
  const day = cycleDay(data, todayISO);
  const fertile = p && upcomingFertileWindow(p, todayISO);
  const todayLog = data.days[todayISO];
  const onPeriodToday = !!todayLog?.flow && todayLog.flow !== 'spotting';

  let headline: string;
  let sub = '';
  if (!p) {
    headline = 'Welcome';
    sub = 'Log your first period to see predictions.';
  } else {
    const until = diffDays(todayISO, p.nextStart);
    if (onPeriodToday) headline = 'Period';
    else if (until > 0) headline = `Period in ${plural(until, 'day')}`;
    else if (until === 0) headline = 'Period expected today';
    else headline = `Period ${plural(-until, 'day')} late`;
    sub = `Expected ${fmtShort(p.nextStart)}`;
  }

  return (
    <section class="screen today">
      <div class="ring" aria-live="polite">
        {day !== null && <div class="ring-day">Cycle day {day}</div>}
        <div class="ring-headline">{headline}</div>
        {sub && <div class="ring-sub">{sub}</div>}
      </div>

      <div class="actions">
        {!onPeriodToday && (
          <button type="button" class="primary" onClick={onStartPeriod}>
            Period started today
          </button>
        )}
        <button type="button" class="secondary" onClick={() => onOpenDay(todayISO)}>
          {todayLog ? "Edit today's log" : 'Log symptoms or mood'}
        </button>
      </div>

      {p && fertile && (
        <div class="card">
          <h3>Estimates</h3>
          <dl class="facts">
            <dt>Next fertile window</dt>
            <dd>
              {fmtShort(fertile.start)} to {fmtShort(fertile.end)}
            </dd>
            <dt>Ovulation</dt>
            <dd>{fmtShort(fertile.ovulation)}</dd>
            <dt>Typical cycle</dt>
            <dd>{plural(p.avgCycle, 'day')}</dd>
          </dl>
          {p.usingDefaults && <p class="muted small">Log 2 full cycles for predictions based on your own data.</p>}
          <p class="muted small">Estimates only. Do not use them as birth control.</p>
        </div>
      )}
    </section>
  );
}
