import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ records: new Map(), uid: 'p1', listeners: [], stops: [] }));
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: { get uid() { return state.uid; } } } }));
vi.mock('firebase/firestore', () => ({
  collection: (_, name) => name, doc: (_, name, id) => ({ id, path: `${name}/${id}` }),
  query: (ref, filter) => ({ ref, filter }), where: (...args) => args,
  Timestamp: { fromMillis: (value) => value }, serverTimestamp: () => Date.now(),
  onSnapshot: (ref, options, success, error) => { const stop = vi.fn(); state.listeners.push({ ref, options, success, error }); state.stops.push(stop); return stop; },
  runTransaction: async (_, fn) => {
    const writes = [];
    const result = await fn({
      get: async (ref) => ({ exists: () => state.records.has(ref.path), data: () => state.records.get(ref.path) }),
      set: (ref, value) => writes.push(() => state.records.set(ref.path, value)),
      update: (ref, value) => writes.push(() => state.records.set(ref.path, { ...state.records.get(ref.path), ...value })),
    });
    writes.forEach((write) => write()); return result;
  },
}));
import { createInvite, generateInviteCode, INVITE_LIFETIME, normalizeInvite, redeemInvite, watchLinkedPatient } from './familyDatabase';
beforeEach(() => {
  state.records.clear(); state.uid = 'p1'; state.listeners = []; state.stops = [];
  state.records.set('users/p1', { name: 'Meena', role: 'patient', mode: 'elderly' });
  state.records.set('users/f1', { name: 'Son', role: 'family' });
  state.records.set('users/f2', { name: 'Other family', role: 'family' });
});
it('normalizes formatted codes and rejects malformed input', () => {
  expect(normalizeInvite('abcd-efgh')).toBe('ABCDEFGH');
  for (const invalid of ['', '123', 'OOOO-OOOO', 'ABCD/EFGH']) expect(() => normalizeInvite(invalid)).toThrow();
  expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
});
it('reuses an active invite and replaces it atomically when requested', async () => {
  const first = await createInvite('p1');
  expect(first.expiresAt).toBeGreaterThan(Date.now() + INVITE_LIFETIME - 1000);
  expect((await createInvite('p1')).inviteCode).toBe(first.inviteCode);
  const replacement = await createInvite('p1', true);
  expect(replacement.inviteCode).not.toBe(first.inviteCode);
  expect(state.records.get(`links/invite_${first.inviteCode}`).state).toBe('replaced');
  expect(state.records.get('users/p1')).toMatchObject({ role: 'patient', mode: 'elderly', inviteCode: replacement.inviteCode });
});
it('redeems once, preserves one pair across retries, and rejects use by a different family', async () => {
  const invite = await createInvite('p1'); state.uid = 'f1';
  expect(await redeemInvite('f1', invite.inviteCode)).toBe('pair_p1_f1');
  expect(await redeemInvite('f1', invite.inviteCode)).toBe('pair_p1_f1');
  expect([...state.records.values()].filter((item) => item.kind === 'link')).toHaveLength(1);
  expect(state.records.get('links/pair_p1_f1')).toMatchObject({ patientId: 'p1', familyUserId: 'f1', patientName: 'Meena', familyName: 'Son' });
  state.uid = 'f2';
  await expect(redeemInvite('f2', invite.inviteCode)).rejects.toMatchObject({ code: 'family/unavailable-code' });
});
it('does not duplicate a pair when the same family redeems a second fresh code', async () => {
  const first = await createInvite('p1'); state.uid = 'f1'; await redeemInvite('f1', first.inviteCode);
  state.uid = 'p1'; const second = await createInvite('p1'); state.uid = 'f1'; await redeemInvite('f1', second.inviteCode);
  expect([...state.records.values()].filter((item) => item.kind === 'link')).toHaveLength(1);
});
it('rejects expired codes, wrong roles, and a caller impersonating another account', async () => {
  const invite = await createInvite('p1');
  state.records.set(`links/invite_${invite.inviteCode}`, { ...invite, expiresAt: Date.now() - 1 });
  await expect(redeemInvite('p1', invite.inviteCode)).rejects.toMatchObject({ code: 'family/role' });
  state.uid = 'f1';
  await expect(createInvite('f1')).rejects.toMatchObject({ code: 'family/role' });
  await expect(redeemInvite('f1', invite.inviteCode)).rejects.toMatchObject({ code: 'family/unavailable-code' });
  await expect(redeemInvite('f2', invite.inviteCode)).rejects.toMatchObject({ code: 'family/sign-in' });
});
it('reports cached/ready snapshots accurately and unsubscribes every listener', () => {
  const change = vi.fn(); const error = vi.fn(); const stop = watchLinkedPatient('p1', change, error);
  state.listeners[0].success({ exists: () => true, data: () => ({ name: 'Meena' }), metadata: { fromCache: true, hasPendingWrites: false } });
  expect(change.mock.lastCall[0]).toMatchObject({ ready: false, fromCache: true });
  for (const listener of state.listeners.slice(1)) listener.success({ docs: [], metadata: { fromCache: false, hasPendingWrites: false } });
  expect(change.mock.lastCall[0]).toMatchObject({ ready: true, fromCache: true, alertsFromCache: false });
  state.listeners[0].success({ exists: () => true, data: () => ({ name: 'Meena' }), metadata: { fromCache: false, hasPendingWrites: false } });
  expect(change.mock.lastCall[0]).toMatchObject({ ready: true, fromCache: false });
  const count = change.mock.calls.length; stop();
  state.stops.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalledOnce());
  state.listeners[3].success({ docs: [], metadata: { fromCache: false } });
  expect(change).toHaveBeenCalledTimes(count);
});
