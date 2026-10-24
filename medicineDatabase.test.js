import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ records: new Map(), uid: 'p1' }));
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: { get uid() { return state.uid; } } } }));
vi.mock('firebase/firestore', () => ({
  collection: (_, name) => name,
  doc: (_, name, id) => id ? `${name}/${id}` : `${name}/new`,
  Timestamp: { fromMillis: (value) => value }, serverTimestamp: () => Date.now(),
  runTransaction: async (_, fn) => {
    const writes = [];
    const result = await fn({
      get: async (ref) => ({ exists: () => state.records.has(ref), data: () => state.records.get(ref) }),
      set: (ref, value) => writes.push(() => state.records.set(ref, value)),
      update: (ref, value) => writes.push(() => state.records.set(ref, { ...state.records.get(ref), ...value })),
    });
    writes.forEach((write) => write());
    return result;
  },
}));
import { recordDose, scheduleDemo } from './medicineDatabase';
import { doseId, MISSED_AFTER_MS } from './doses';
const scheduledTime = new Date(2026, 9, 23, 9).getTime();
const medicine = { id: 'm1', patientId: 'p1', name: 'Example', dose: '1 tablet', times: ['09:00'], createdAt: scheduledTime - 1000 };
const occurrence = { medicine, scheduledTime };
const logRef = `doseLogs/${doseId('m1', scheduledTime)}`;
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(scheduledTime);
  state.uid = 'p1'; state.records.clear(); state.records.set('medicines/m1', medicine);
});
it('cannot mark missed before 15 minutes, then atomically saves one log and one alert', async () => {
  await expect(recordDose('p1', occurrence, 'missed', 'Meena', [medicine])).rejects.toThrow('not due');
  vi.spyOn(Date, 'now').mockReturnValue(scheduledTime + MISSED_AFTER_MS);
  expect(await recordDose('p1', occurrence, 'missed', 'Meena', [medicine])).toBe(true);
  expect(await recordDose('p1', occurrence, 'missed', 'Meena', [medicine])).toBe(false);
  expect(state.records.get(logRef).status).toBe('missed');
  expect([...state.records.keys()].filter((key) => key.startsWith('alerts/'))).toHaveLength(1);
  expect(state.records.get(`alerts/missed_${doseId('m1', scheduledTime)}`)).toMatchObject({ patientId: 'p1', patientName: 'Meena', type: 'missedDose', location: null });
});
it('never overwrites Taken with missed', async () => {
  await recordDose('p1', occurrence, 'taken', 'Meena', [medicine]);
  vi.spyOn(Date, 'now').mockReturnValue(scheduledTime + MISSED_AFTER_MS);
  await recordDose('p1', occurrence, 'missed', 'Meena', [medicine]);
  expect(state.records.get(logRef).status).toBe('taken');
  expect(state.records.size).toBe(2);
});
it('late Taken saves a missed alert even if it beats the background checker', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(scheduledTime + MISSED_AFTER_MS);
  await recordDose('p1', occurrence, 'taken', 'Meena', [medicine]);
  expect(state.records.get(logRef)).toMatchObject({ status: 'taken', wasMissed: true });
  expect(state.records.size).toBe(3);
});
it('late Taken preserves the original missed alert', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(scheduledTime + MISSED_AFTER_MS);
  await recordDose('p1', occurrence, 'missed', 'Meena', [medicine]);
  const alert = state.records.get(`alerts/missed_${doseId('m1', scheduledTime)}`);
  await recordDose('p1', occurrence, 'taken', 'Meena', [medicine]);
  expect(state.records.get(logRef)).toMatchObject({ status: 'taken', wasMissed: true });
  expect(state.records.get(`alerts/missed_${doseId('m1', scheduledTime)}`)).toBe(alert);
});
it('prevents a second demo from replacing a pending one', async () => {
  expect(await scheduleDemo('p1', 'm1')).toBe(scheduledTime + 60000);
  await expect(scheduleDemo('p1', 'm1')).rejects.toThrow('already has a demo');
});
it('lets an expired demo be replaced after the 24-hour catch-up window', async () => {
  state.records.set('medicines/m1', { ...medicine, demoAt: scheduledTime - 86400001 });
  expect(await scheduleDemo('p1', 'm1')).toBe(scheduledTime + 60000);
});
it('rejects another patient’s medicine and invented dose times', async () => {
  state.records.set('medicines/m1', { ...medicine, patientId: 'other' });
  await expect(recordDose('p1', occurrence, 'taken', 'Meena', [])).rejects.toThrow('no longer');
  state.records.set('medicines/m1', medicine);
  await expect(recordDose('p1', { ...occurrence, scheduledTime: scheduledTime - 500 }, 'taken', 'Meena', [])).rejects.toThrow('no longer');
  expect(state.records.size).toBe(1);
});
