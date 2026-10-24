import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ records: new Map(), next: 0 }));
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: { uid: 'p1' } } }));
vi.mock('firebase/firestore', () => ({
  collection: (_, name) => name,
  doc: (parent, name, id) => id ? `${name}/${id}` : `${parent}/generated-${++state.next}`,
  serverTimestamp: () => 1, Timestamp: { fromMillis: (time) => time },
  onSnapshot: vi.fn(), query: vi.fn(), where: vi.fn(),
  runTransaction: async (_, work) => work({
    get: async (ref) => ({ data: () => state.records.get(ref) }),
    set: (ref, data) => state.records.set(ref, data),
    update: (ref, data) => state.records.set(ref, { ...state.records.get(ref), ...data }),
  }),
}));
import { saveAppointment, updateAppointment } from './appointmentDatabase';
const fields = () => ({ doctor: 'Example clinic', scheduledTime: Date.now() + 1800000, reminderMinutes: 60 });
beforeEach(() => { state.records.clear(); state.next = 0; });
it('creates and edits a visit without retaining an old acknowledgement or demo', async () => {
  await saveAppointment('p1', fields());
  const key = [...state.records.keys()][0]; const id = key.split('/')[1];
  const old = state.records.get(key);
  state.records.set(key, { ...old, acknowledged: { advance: true }, demoAt: 123 });
  await saveAppointment('p1', { ...fields(), doctor: 'Updated clinic' }, id);
  expect(state.records.get(key)).toMatchObject({ revision: 2, acknowledged: {}, demoAt: null, doctor: 'Updated clinic' });
});
it('rejects impersonation and cannot edit another patient’s visit', async () => {
  await expect(saveAppointment('other', fields())).rejects.toThrow('Sign in');
  state.records.set('appointments/a1', { patientId: 'other', status: 'scheduled' });
  await expect(saveAppointment('p1', fields(), 'a1')).rejects.toThrow('no longer');
  await expect(updateAppointment('p1', 'a1', 'cancel')).rejects.toThrow('not found');
});
it('accepts only an actually due, current-revision acknowledgement', async () => {
  const appointment = { patientId: 'p1', status: 'scheduled', revision: 2, scheduledAt: Date.now() + 60000, reminderMinutes: 60 };
  state.records.set('appointments/a1', appointment);
  expect(await updateAppointment('p1', 'a1', 'acknowledge', { id: 'a1:1:advance', kind: 'advance' })).toBe(false);
  expect(await updateAppointment('p1', 'a1', 'acknowledge', { id: 'a1:2:advance', kind: 'advance' })).toBe(true);
  expect(state.records.get('appointments/a1')).toMatchObject({ status: 'scheduled', acknowledged: { advance: true } });
});
it('does not duplicate pending demos and makes cancellation stop future changes', async () => {
  state.records.set('appointments/a1', { patientId: 'p1', status: 'scheduled', revision: 1, scheduledAt: Date.now() + 3600000 });
  await updateAppointment('p1', 'a1', 'demo');
  await expect(updateAppointment('p1', 'a1', 'demo')).rejects.toThrow('already pending');
  await updateAppointment('p1', 'a1', 'cancel');
  expect(state.records.get('appointments/a1').status).toBe('cancelled');
  expect(await updateAppointment('p1', 'a1', 'demo')).toBe(false);
});
