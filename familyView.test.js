import { expect, it } from 'vitest';
import { createAlertTracker, newestAlerts, todaysLogs } from './familyView';
it('does not ring for old/cache alerts, rings once for new server alerts, and ignores edits', () => {
  const track = createAlertTracker();
  expect(track([{ id: 'cache' }], false)).toEqual([]);
  expect(track([{ id: 'old' }], true)).toEqual([]);
  expect(track([{ id: 'old' }, { id: 'new' }], true)).toEqual([{ id: 'new' }]);
  expect(track([{ id: 'old' }, { id: 'new', updated: true }], true)).toEqual([]);
});
it('shows only today’s scheduled logs, keeping late Taken separate from missed status', () => {
  const now = new Date(2026, 9, 23, 12).getTime();
  const today = new Date(2026, 9, 23, 9).getTime();
  const logs = [{ id: 'taken-late', scheduledTime: today, status: 'taken', wasMissed: true }, { id: 'missed', scheduledTime: today + 1000, status: 'missed' }, { id: 'yesterday', scheduledTime: today - 86400000, status: 'taken' }];
  expect(todaysLogs(logs, now).map((item) => item.id)).toEqual(['taken-late', 'missed']);
});
it('sorts alerts by server creation time without mutating listener data', () => {
  const input = [{ id: 'a', createdAt: 10 }, { id: 'b', createdAt: { toMillis: () => 20 } }];
  expect(newestAlerts(input).map((item) => item.id)).toEqual(['b', 'a']);
  expect(input[0].id).toBe('a');
});
