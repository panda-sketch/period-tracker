import { addDays, diffDays, type ISODate } from './dates';
import type { TrackerData } from './types';

/** Flow days separated by at most this many empty days belong to one period. */
export const PERIOD_GAP_DAYS = 2;
/** Cycles outside this range are treated as missed logging, not real cycles. */
export const MIN_CYCLE = 15;
export const MAX_CYCLE = 60;
export const DEFAULT_CYCLE = 28;
export const DEFAULT_PERIOD = 5;
export const RECENT_CYCLES = 6;
export const LUTEAL_DAYS = 14;

export interface Period {
  start: ISODate;
  end: ISODate;
  length: number;
}

export interface Cycle {
  start: ISODate;
  /** Days until the next period started; undefined for the current cycle. */
  length?: number;
  periodLength: number;
}

export interface Prediction {
  /** True when fewer than 2 complete cycles exist and defaults were used. */
  usingDefaults: boolean;
  avgCycle: number;
  avgPeriod: number;
  nextStart: ISODate;
  ovulation: ISODate;
  fertileStart: ISODate;
  fertileEnd: ISODate;
}

/** Spotting alone does not start a period; light, medium or heavy flow does. */
function isPeriodDay(flow: string | undefined): boolean {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

export function periods(data: TrackerData): Period[] {
  const days = Object.values(data.days)
    .filter((d) => isPeriodDay(d.flow))
    .map((d) => d.date)
    .sort();
  const out: Period[] = [];
  for (const date of days) {
    const last = out[out.length - 1];
    if (last && diffDays(last.end, date) <= PERIOD_GAP_DAYS + 1) {
      last.end = date;
      last.length = diffDays(last.start, date) + 1;
    } else {
      out.push({ start: date, end: date, length: 1 });
    }
  }
  return out;
}

export function cycles(data: TrackerData): Cycle[] {
  const ps = periods(data);
  return ps.map((p, i) => ({
    start: p.start,
    length: i + 1 < ps.length ? diffDays(p.start, ps[i + 1].start) : undefined,
    periodLength: p.length,
  }));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Complete cycles with plausible lengths, most recent last. */
export function validCycles(data: TrackerData): Cycle[] {
  return cycles(data).filter(
    (c): c is Cycle & { length: number } =>
      c.length !== undefined && c.length >= MIN_CYCLE && c.length <= MAX_CYCLE,
  );
}

export function predict(data: TrackerData, todayISO: ISODate): Prediction | null {
  const ps = periods(data);
  if (ps.length === 0) return null;
  const recent = validCycles(data).slice(-RECENT_CYCLES);
  const usingDefaults = recent.length < 2;
  const avgCycle = usingDefaults ? DEFAULT_CYCLE : Math.round(mean(recent.map((c) => c.length!)));
  const recentPeriods = ps.slice(-RECENT_CYCLES).map((p) => p.length);
  const avgPeriod = ps.length < 2 ? DEFAULT_PERIOD : Math.round(mean(recentPeriods));

  // Roll forward from the last logged start so a late period still gets a
  // prediction that is not in the past.
  let nextStart = addDays(ps[ps.length - 1].start, avgCycle);
  while (diffDays(todayISO, nextStart) < 0 && diffDays(ps[ps.length - 1].start, todayISO) > MAX_CYCLE) {
    nextStart = addDays(nextStart, avgCycle);
  }
  const ovulation = addDays(nextStart, -LUTEAL_DAYS);
  return {
    usingDefaults,
    avgCycle,
    avgPeriod,
    nextStart,
    ovulation,
    fertileStart: addDays(ovulation, -5),
    fertileEnd: addDays(ovulation, 1),
  };
}

export type DayKind = 'predicted-period' | 'fertile' | 'ovulation';

/** Predicted marks for the next `count` cycles, keyed by date. */
export function forecast(p: Prediction, count = 3): Map<ISODate, DayKind> {
  const out = new Map<ISODate, DayKind>();
  for (let i = 0; i < count; i++) {
    const start = addDays(p.nextStart, i * p.avgCycle);
    const ov = addDays(start, -LUTEAL_DAYS);
    for (let d = -5; d <= 1; d++) out.set(addDays(ov, d), d === 0 ? 'ovulation' : 'fertile');
    for (let d = 0; d < p.avgPeriod; d++) out.set(addDays(start, d), 'predicted-period');
  }
  return out;
}

export interface Stats {
  cycleCount: number;
  avgCycle?: number;
  shortest?: number;
  longest?: number;
  avgPeriod?: number;
  history: Cycle[];
}

export function stats(data: TrackerData): Stats {
  const all = cycles(data);
  const valid = validCycles(data).map((c) => c.length!);
  const ps = periods(data).map((p) => p.length);
  return {
    cycleCount: valid.length,
    avgCycle: valid.length ? Math.round(mean(valid) * 10) / 10 : undefined,
    shortest: valid.length ? Math.min(...valid) : undefined,
    longest: valid.length ? Math.max(...valid) : undefined,
    avgPeriod: ps.length ? Math.round(mean(ps) * 10) / 10 : undefined,
    history: [...all].reverse(),
  };
}

/** Day number within the current cycle (day 1 = first period day), or null. */
export function cycleDay(data: TrackerData, todayISO: ISODate): number | null {
  const ps = periods(data).filter((p) => diffDays(p.start, todayISO) >= 0);
  if (!ps.length) return null;
  return diffDays(ps[ps.length - 1].start, todayISO) + 1;
}

/** The current or next fertile window, skipping one that has already ended. */
export function upcomingFertileWindow(p: Prediction, todayISO: ISODate): { start: ISODate; end: ISODate; ovulation: ISODate } {
  let shift = 0;
  while (diffDays(todayISO, addDays(p.fertileEnd, shift)) < 0) shift += p.avgCycle;
  return { start: addDays(p.fertileStart, shift), end: addDays(p.fertileEnd, shift), ovulation: addDays(p.ovulation, shift) };
}
