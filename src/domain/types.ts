import type { ISODate } from './dates';

export const FLOWS = ['spotting', 'light', 'medium', 'heavy'] as const;
export type Flow = (typeof FLOWS)[number];

export const BUILTIN_SYMPTOMS = [
  'cramps',
  'headache',
  'bloating',
  'acne',
  'breast tenderness',
  'fatigue',
  'nausea',
  'back pain',
] as const;

export const MOODS = ['happy', 'calm', 'sad', 'anxious', 'irritable', 'tired'] as const;
export type Mood = (typeof MOODS)[number];

export interface DayLog {
  date: ISODate;
  flow?: Flow;
  /** Built-in symptom names and custom tags. */
  symptoms: string[];
  mood?: Mood;
  note?: string;
}

export interface TrackerData {
  version: 1;
  days: Record<ISODate, DayLog>;
  customSymptoms: string[];
}

export function emptyData(): TrackerData {
  return { version: 1, days: {}, customSymptoms: [] };
}

export function isEmptyLog(d: DayLog): boolean {
  return !d.flow && d.symptoms.length === 0 && !d.mood && !d.note?.trim();
}
