// FR-11: a reminder a few days before the predicted period. The app cannot
// notify on its own while closed, so it hands the phone's calendar an event
// with an alert, and shows a banner when opened.

import { addDays, diffDays, type ISODate } from './dates';
import type { Prediction } from './cycles';
import type { ReminderSettings } from './types';

export function reminderDate(p: Prediction, r: ReminderSettings): ISODate {
  return addDays(p.nextStart, -r.daysBefore);
}

/** Days until the predicted start when inside the reminder window, else null. */
export function bannerDaysLeft(p: Prediction, r: ReminderSettings, todayISO: ISODate): number | null {
  if (!r.enabled) return null;
  const left = diffDays(todayISO, p.nextStart);
  return left >= 0 && left <= r.daysBefore ? left : null;
}

/** True when a reminder was added to the calendar but the prediction has since moved. */
export function calendarOutOfDate(p: Prediction, r: ReminderSettings, todayISO: ISODate): boolean {
  if (!r.enabled || !r.exportedFor) return false;
  const want = reminderDate(p, r);
  return want !== r.exportedFor && diffDays(todayISO, want) >= 0;
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const compact = (d: ISODate) => d.replace(/-/g, '');

/**
 * An iCalendar file with one all-day event and a 9:00 alert on that day.
 * The UID is fixed so calendars that support it replace the previous reminder.
 */
export function buildICS(date: ISODate, title: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cycle Tracker//Reminder//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:cycle-tracker-reminder@local',
    `SEQUENCE:${Math.floor(now.getTime() / 1000)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
    `SUMMARY:${escapeText(title.slice(0, 60))}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title.slice(0, 60))}`,
    'TRIGGER;RELATED=START:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
