import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
const sound = vi.hoisted(() => ({ enabled: false, message: 'Enable sound', enable: vi.fn(), mute: vi.fn(), play: vi.fn() }));
vi.mock('../context/SpeechContext', () => ({ useScreenSpeech: vi.fn() }));
vi.mock('../hooks/useAlertSound', () => ({ useAlertSound: () => sound }));
import FamilyPage from './FamilyPage';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup() {
  let update;
  const stop = vi.fn();
  const services = {
    redeemInvite: vi.fn().mockResolvedValue('link'),
    watchFamilyConnections: (_, callback) => { callback({ records: [{ kind: 'link', id: 'link', patientId: 'p1', patientName: 'Meena' }], fromCache: false }); return vi.fn(); },
    watchLinkedPatient: (_, callback) => { update = callback; return stop; },
  };
  const view = render(<AuthContext.Provider value={{ user: { uid: 'f1' }, profile: { name: 'Son', role: 'family' } }}><FamilyPage services={services} /></AuthContext.Provider>);
  const data = { profile: { name: 'Meena' }, medicines: [], logs: [], alerts: [], ready: true, fromCache: false, alertsFromCache: false };
  return { services, view, data, update: (value) => act(() => update(value)), stop };
}
it('loads old alerts quietly, shows a banner and plays once for a new alert, and preserves history after dismiss', () => {
  const test = setup();
  const old = { id: 'old', type: 'sos', createdAt: Date.now() - 1000, medicines: [] };
  test.update({ ...test.data, alerts: [old] });
  expect(screen.queryByRole('alert')).toBeNull(); expect(sound.play).not.toHaveBeenCalled();
  const fresh = { id: 'fresh', type: 'fall', createdAt: Date.now(), medicines: [] };
  test.update({ ...test.data, alerts: [old, fresh] });
  expect(screen.getByRole('alert').textContent).toBe('1 new alert'); expect(sound.play).toHaveBeenCalledOnce();
  test.update({ ...test.data, alerts: [old, { ...fresh, updated: true }] });
  expect(sound.play).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }));
  expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByText('Manual simulation; no real fall was detected.')).toBeTruthy();
  test.view.unmount(); expect(test.stop).toHaveBeenCalledOnce();
});
it('renders linked dose and hospital data and marks cached data honestly', () => {
  const test = setup();
  test.update({ ...test.data, fromCache: true, logs: [{ id: 'log', medicineName: 'Example', status: 'taken', wasMissed: true, scheduledTime: Date.now() }], profile: { name: 'Meena', nearby: { updatedAt: Date.now(), nearestHospital: { name: 'Example Hospital', latitude: 28.6, longitude: 77.2, distanceKm: .4 }, location: { latitude: 28.6, longitude: 77.2 } } } });
  expect(screen.getByText('Taken late')).toBeTruthy(); expect(screen.getByText('Cached data · reconnecting')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Hospital directions ↗' }).href).toContain('destination=28.6,77.2');
});
it('rejects malformed codes locally and shows a failed connection without success', async () => {
  const test = setup();
  fireEvent.change(screen.getByLabelText('Patient invite code'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect patient' }));
  expect(screen.getByRole('alert').textContent).toContain('eight characters');
  expect(test.services.redeemInvite).not.toHaveBeenCalled();
  test.services.redeemInvite.mockRejectedValue({ code: 'family/unavailable-code' });
  fireEvent.change(screen.getByLabelText('Patient invite code'), { target: { value: 'ABCD-EFGH' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Connect patient' })));
  expect(screen.getByRole('alert').textContent).toContain('expired');
  expect(screen.queryByText(/Connection saved/)).toBeNull();
});
