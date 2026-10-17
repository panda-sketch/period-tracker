import { isValidISO } from '../domain/dates';
import { FLOWS, MOODS, emptyData, type DayLog, type TrackerData } from '../domain/types';

/** Checks and normalises data read from storage or a backup file. Throws on bad shape. */
export function validateData(raw: unknown): TrackerData {
  if (!raw || typeof raw !== 'object') throw new Error('Not a tracker data object');
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) throw new Error('Unsupported data version');
  const out = emptyData();
  if (Array.isArray(r.customSymptoms)) {
    out.customSymptoms = r.customSymptoms.filter((s): s is string => typeof s === 'string').slice(0, 100);
  }
  const days = r.days && typeof r.days === 'object' ? (r.days as Record<string, unknown>) : {};
  for (const [date, v] of Object.entries(days)) {
    if (!isValidISO(date) || !v || typeof v !== 'object') continue;
    const d = v as Record<string, unknown>;
    const log: DayLog = {
      date,
      symptoms: Array.isArray(d.symptoms) ? d.symptoms.filter((s): s is string => typeof s === 'string') : [],
    };
    if ((FLOWS as readonly unknown[]).includes(d.flow)) log.flow = d.flow as DayLog['flow'];
    if ((MOODS as readonly unknown[]).includes(d.mood)) log.mood = d.mood as DayLog['mood'];
    if (typeof d.note === 'string' && d.note) log.note = d.note.slice(0, 2000);
    out.days[date] = log;
  }
  return out;
}
