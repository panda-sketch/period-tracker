import { stats } from '../domain/cycles';
import type { TrackerData } from '../domain/types';
import { fmtShort } from './format';

export function Stats({ data }: { data: TrackerData }) {
  const s = stats(data);
  const tile = (label: string, v?: number) => (
    <div class="tile">
      <div class="tile-value">{v ?? '–'}</div>
      <div class="tile-label">{label}</div>
    </div>
  );
  return (
    <section class="screen stats">
      <h2>Your cycles</h2>
      <div class="tiles">
        {tile('Average cycle (days)', s.avgCycle)}
        {tile('Average period (days)', s.avgPeriod)}
        {tile('Shortest cycle', s.shortest)}
        {tile('Longest cycle', s.longest)}
      </div>
      <h3>History</h3>
      {s.history.length === 0 ? (
        <p class="muted">No periods logged yet.</p>
      ) : (
        <table class="history">
          <thead>
            <tr>
              <th>Started</th>
              <th>Cycle</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            {s.history.map((c) => (
              <tr>
                <td>{fmtShort(c.start)}</td>
                <td>{c.length ? `${c.length} days` : 'Current'}</td>
                <td>{c.periodLength} days</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
