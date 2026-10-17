import { cycleDay, predict, upcomingFertileWindow } from '../domain/cycles';
import { diffDays, type ISODate } from '../domain/dates';
import type { TrackerData } from '../domain/types';
import { bannerDaysLeft, calendarOutOfDate, reminderDate } from '../domain/reminder';
import { fmtShort, plural } from './format';

interface Props {
  data: TrackerData;
  todayISO: ISODate;
  onStartPeriod: () => void;
  onOpenDay: (d: ISODate) => void;
  onAddReminder: () => void;
}

export function Today({ data, todayISO, onStartPeriod, onOpenDay, onAddReminder }: Props) {
  const p = predict(data, todayISO);
  const day = cycleDay(data, todayISO);
  const fertile = p && upcomingFertileWindow(p, todayISO);
  const todayLog = data.days[todayISO];
  const onPeriodToday = !!todayLog?.flow && todayLog.flow !== 'spotting';
  const daysLeft = p && !onPeriodToday ? bannerDaysLeft(p, data.reminder, todayISO) : null;
  const staleCalendar = !!p && calendarOutOfDate(p, data.reminder, todayISO);

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
      {daysLeft !== null && (
        <div class="banner" role="status">
          {daysLeft === 0 ? 'Reminder: your period is expected today.' : 'Reminder: your period is coming soon.'}
        </div>
      )}
      {staleCalendar && (
        <div class="banner notice">
          <span>Your next reminder date is now {fmtShort(reminderDate(p!, data.reminder))}.</span>
          <button type="button" class="secondary" onClick={onAddReminder}>
            Update calendar
          </button>
        </div>
      )}
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
