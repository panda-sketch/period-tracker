import { parseISO, type ISODate } from '../domain/dates';

// Dates are stored as UTC midnights, so format them in UTC to show the right day.
const short = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const long = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const fmtShort = (d: ISODate) => short.format(parseISO(d));
export const fmtLong = (d: ISODate) => long.format(parseISO(d));
export const fmtMonth = (y: number, m: number) => monthYear.format(new Date(Date.UTC(y, m, 1)));

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
