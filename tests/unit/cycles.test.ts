import { describe, expect, it } from 'vitest';
import { addDays, diffDays, monthGrid, today, isValidISO } from '../../src/domain/dates';
import { cycleDay, cycles, forecast, periods, predict, stats, upcomingFertileWindow } from '../../src/domain/cycles';
import { emptyData, type Flow, type TrackerData } from '../../src/domain/types';

function withPeriods(starts: string[], len = 5, flow: Flow = 'medium'): TrackerData {
  const data = emptyData();
  for (const s of starts) {
    for (let i = 0; i < len; i++) {
      const date = addDays(s, i);
      data.days[date] = { date, flow, symptoms: [] };
    }
  }
  return data;
}

describe('dates', () => {
  it('handles month and leap-year boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(diffDays('2025-03-01', '2025-03-31')).toBe(30);
  });
  it('validates dates', () => {
    expect(isValidISO('2025-02-29')).toBe(false);
    expect(isValidISO('2024-02-29')).toBe(true);
    expect(isValidISO('nope')).toBe(false);
  });
  it('uses the local calendar day', () => {
    expect(today(new Date(2026, 9, 16, 23, 59))).toBe('2026-10-16');
  });
  it('builds a Monday-first month grid', () => {
    const g = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(g.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(g.length % 7).toBe(0);
  });
});

describe('periods', () => {
  it('groups consecutive flow days and tolerates short gaps', () => {
    const data = withPeriods(['2026-01-01']);
    data.days['2026-01-08'] = { date: '2026-01-08', flow: 'light', symptoms: [] }; // 2-day gap
    expect(periods(data)).toEqual([{ start: '2026-01-01', end: '2026-01-08', length: 8 }]);
  });
  it('splits on longer gaps', () => {
    const data = withPeriods(['2026-01-01', '2026-01-29']);
    expect(periods(data).map((p) => p.start)).toEqual(['2026-01-01', '2026-01-29']);
  });
  it('ignores spotting', () => {
    const data = withPeriods(['2026-01-01'], 3, 'spotting');
    expect(periods(data)).toEqual([]);
  });
});

describe('predict', () => {
  it('returns null with no data', () => {
    expect(predict(emptyData(), '2026-01-01')).toBeNull();
  });
  it('uses the 28-day default with fewer than 2 cycles', () => {
    const p = predict(withPeriods(['2026-01-01', '2026-01-31']), '2026-02-05')!;
    expect(p.usingDefaults).toBe(true);
    expect(p.nextStart).toBe('2026-02-28');
  });
  it('averages recent cycle lengths', () => {
    const p = predict(withPeriods(['2026-01-01', '2026-01-31', '2026-03-02']), '2026-03-05')!;
    expect(p.usingDefaults).toBe(false);
    expect(p.avgCycle).toBe(30);
    expect(p.nextStart).toBe('2026-04-01');
    expect(p.ovulation).toBe('2026-03-18');
    expect(p.fertileStart).toBe('2026-03-13');
    expect(p.fertileEnd).toBe('2026-03-19');
    expect(p.avgPeriod).toBe(5);
  });
  it('ignores implausible cycles from missed logging', () => {
    const data = withPeriods(['2025-01-01', '2025-06-01', '2025-06-29', '2025-07-27']);
    expect(predict(data, '2025-08-01')!.avgCycle).toBe(28);
  });
  it('keeps a late prediction in the past so lateness is visible', () => {
    const p = predict(withPeriods(['2026-01-01', '2026-01-29', '2026-02-26']), '2026-03-30')!;
    expect(p.nextStart).toBe('2026-03-26');
  });
  it('rolls forward when logging stopped long ago', () => {
    const p = predict(withPeriods(['2026-01-01', '2026-01-29']), '2026-06-01')!;
    expect(diffDays('2026-06-01', p.nextStart)).toBeGreaterThanOrEqual(0);
  });
  it('forecasts several cycles', () => {
    const p = predict(withPeriods(['2026-01-01', '2026-01-29', '2026-02-26']), '2026-03-01')!;
    const f = forecast(p, 2);
    expect(f.get('2026-03-26')).toBe('predicted-period');
    expect(f.get('2026-04-23')).toBe('predicted-period');
    expect(f.get('2026-03-12')).toBe('ovulation');
    expect(f.get('2026-03-07')).toBe('fertile');
  });
});

describe('stats', () => {
  it('summarises cycles', () => {
    const data = withPeriods(['2026-01-01', '2026-01-27', '2026-02-27'], 4);
    const s = stats(data);
    expect(s.cycleCount).toBe(2);
    expect(s.shortest).toBe(26);
    expect(s.longest).toBe(31);
    expect(s.avgCycle).toBe(28.5);
    expect(s.avgPeriod).toBe(4);
    expect(s.history[0].start).toBe('2026-02-27');
    expect(cycles(data)[2].length).toBeUndefined();
  });
  it('computes the cycle day', () => {
    const data = withPeriods(['2026-01-01']);
    expect(cycleDay(data, '2026-01-10')).toBe(10);
    expect(cycleDay(emptyData(), '2026-01-10')).toBeNull();
  });
});

describe('upcomingFertileWindow', () => {
  it('skips a window that has already passed', () => {
    const data = withPeriods(['2026-01-01', '2026-01-29', '2026-02-26']);
    const p = predict(data, '2026-03-01')!; // window Mar 7 to Mar 13, next period Mar 26
    expect(upcomingFertileWindow(p, '2026-03-10').start).toBe('2026-03-07');
    expect(upcomingFertileWindow(p, '2026-03-20')).toEqual({ start: '2026-04-04', end: '2026-04-10', ovulation: '2026-04-09' });
  });
});
