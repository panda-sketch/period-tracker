import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/dates';
import { predict } from '../../src/domain/cycles';
import { bannerDaysLeft, buildICS, calendarOutOfDate, reminderDate } from '../../src/domain/reminder';
import { DEFAULT_REMINDER, emptyData, type TrackerData } from '../../src/domain/types';
import { validateData } from '../../src/storage/validate';

function withPeriods(starts: string[]): TrackerData {
  const data = emptyData();
  for (const s of starts) for (let i = 0; i < 5; i++) {
    const date = addDays(s, i);
    data.days[date] = { date, flow: 'medium', symptoms: [] };
  }
  return data;
}

// Cycles of 28 days; next period predicted for 2026-03-26.
const data = withPeriods(['2026-01-01', '2026-01-29', '2026-02-26']);
const p = predict(data, '2026-03-01')!;
const r = { ...DEFAULT_REMINDER };

describe('reminder', () => {
  it('falls 5 days before the predicted start by default', () => {
    expect(reminderDate(p, r)).toBe('2026-03-21');
    expect(reminderDate(p, { ...r, daysBefore: 3 })).toBe('2026-03-23');
  });

  it('shows the banner only inside the reminder window', () => {
    expect(bannerDaysLeft(p, r, '2026-03-20')).toBeNull();
    expect(bannerDaysLeft(p, r, '2026-03-21')).toBe(5);
    expect(bannerDaysLeft(p, r, '2026-03-26')).toBe(0);
    expect(bannerDaysLeft(p, r, '2026-03-27')).toBeNull();
    expect(bannerDaysLeft(p, { ...r, enabled: false }, '2026-03-21')).toBeNull();
  });

  it('flags the calendar when the prediction moves', () => {
    expect(calendarOutOfDate(p, r, '2026-03-01')).toBe(false); // never added
    expect(calendarOutOfDate(p, { ...r, exportedFor: '2026-03-21' }, '2026-03-01')).toBe(false);
    expect(calendarOutOfDate(p, { ...r, exportedFor: '2026-03-23' }, '2026-03-01')).toBe(true);
    // A new cycle started, so the next reminder needs adding.
    const later = withPeriods(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']);
    const p2 = predict(later, '2026-03-28')!;
    expect(calendarOutOfDate(p2, { ...r, exportedFor: '2026-03-21' }, '2026-03-28')).toBe(true);
  });

  it('builds a valid all-day calendar event with a 9:00 alert and neutral wording', () => {
    const ics = buildICS('2026-03-21', 'Reminder', new Date('2026-03-01T10:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20260321\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260322\r\n');
    expect(ics).toContain('SUMMARY:Reminder\r\n');
    expect(ics).toContain('TRIGGER;RELATED=START:PT9H\r\n');
    expect(ics).toContain('DTSTAMP:20260301T100000Z\r\n');
    expect(ics.toLowerCase()).not.toMatch(/period|cycle day|menstru/);
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });

  it('escapes special characters in the title', () => {
    expect(buildICS('2026-03-21', 'Call mum; buy tea, etc')).toContain('SUMMARY:Call mum\; buy tea\\, etc\r\n');
  });

  it('keeps reminder settings through storage validation and rejects bad values', () => {
    const d = validateData({ version: 1, days: {}, reminder: { enabled: false, daysBefore: 7, title: 'Hi', exportedFor: '2026-03-21' } });
    expect(d.reminder).toEqual({ enabled: false, daysBefore: 7, title: 'Hi', exportedFor: '2026-03-21' });
    const bad = validateData({ version: 1, days: {}, reminder: { daysBefore: 99, title: '', exportedFor: 'x' } });
    expect(bad.reminder).toEqual(DEFAULT_REMINDER);
    expect(validateData({ version: 1, days: {} }).reminder).toEqual(DEFAULT_REMINDER);
  });
});
