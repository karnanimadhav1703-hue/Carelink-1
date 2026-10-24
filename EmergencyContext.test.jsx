import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ speak: vi.fn() }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { uid: 'p1' }, profile: { role: 'patient', name: 'Meena' } }) }));
vi.mock('./ModeContext', () => ({ useMode: () => ({ mode: 'vision-assist' }) }));
vi.mock('./SpeechContext', () => ({ useSpeech: () => ({ speak: mocks.speak }) }));
import { EmergencyProvider, useEmergency } from './EmergencyContext';
import EmergencyBanner from '../components/EmergencyBanner';
import { setLanguage } from '../lib/i18n';
const denied = { location: null, hospitals: [], locationStatus: 'denied', hospitalStatus: 'not-requested' };
let services;
function Controls() {
  const emergency = useEmergency();
  return <><button onClick={() => emergency.start('sos')}>Start SOS</button><button onClick={() => emergency.start('fall')}>Simulate fall</button><EmergencyBanner /></>;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T10:00:00Z')); mocks.speak.mockClear();
  services = { prepareNearby: vi.fn().mockResolvedValue(denied), saveNearbySummary: vi.fn().mockResolvedValue(), saveEmergencyAlert: vi.fn().mockResolvedValue('alert-1') };
});
afterEach(() => { cleanup(); setLanguage('en'); vi.useRealTimers(); });
async function start(button = 'Start SOS') {
  render(<EmergencyProvider services={services}><Controls /></EmergencyProvider>);
  await act(async () => screen.getByRole('button', { name: button }).click());
}
it('keeps the original SOS deadline and emergency number when switching language mid-countdown', async () => {
  await start();
  await act(async () => vi.advanceTimersByTime(4000));
  act(() => setLanguage('hi'));
  expect(screen.getByRole('button', { name: 'रद्द करें — मैं ठीक हूँ' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /112 पर कॉल करें/ }).getAttribute('href')).toBe('tel:112');
  await act(async () => vi.advanceTimersByTime(6000));
  expect(services.saveEmergencyAlert).toHaveBeenCalledTimes(1);
  expect(screen.getByText('अलर्ट सहेजा गया')).toBeTruthy();
});
it('gives ten seconds to cancel, focuses Cancel, and cancellation prevents all alert writes', async () => {
  await start();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Cancel —/ }));
  await act(async () => vi.advanceTimersByTime(9800));
  expect(services.saveEmergencyAlert).not.toHaveBeenCalled();
  await act(async () => screen.getByRole('button', { name: /Cancel —/ }).click());
  await act(async () => vi.advanceTimersByTime(20000));
  expect(screen.getByText('No emergency alert was created.')).toBeTruthy();
  expect(services.saveEmergencyAlert).not.toHaveBeenCalled();
});
it('saves once at ten seconds despite repeated starts and denied GPS', async () => {
  await start();
  await act(async () => screen.getByRole('button', { name: 'Start SOS' }).click());
  await act(async () => vi.advanceTimersByTime(10000));
  expect(services.saveEmergencyAlert).toHaveBeenCalledTimes(1);
  expect(services.saveEmergencyAlert).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'sos', patientName: 'Meena' }), denied);
  expect(screen.getByText('Alert saved')).toBeTruthy();
  await act(async () => vi.advanceTimersByTime(10000));
  expect(services.saveEmergencyAlert).toHaveBeenCalledTimes(1);
});
it('uses the same countdown for a simulated fall and retries the same event after failure', async () => {
  services.saveEmergencyAlert.mockRejectedValueOnce(new Error('offline'));
  await start('Simulate fall');
  await act(async () => vi.advanceTimersByTime(10000));
  expect(screen.getByText('Alert not confirmed')).toBeTruthy();
  const event = services.saveEmergencyAlert.mock.calls[0][1];
  expect(event.type).toBe('fall');
  await act(async () => screen.getByRole('button', { name: 'Retry saving alert' }).click());
  expect(services.saveEmergencyAlert.mock.calls[1][1].id).toBe(event.id);
  expect(screen.getByText('Alert saved')).toBeTruthy();
});
it('shows saving while a bounded lookup finishes, then includes its result', async () => {
  let finish;
  services.prepareNearby.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await start();
  await act(async () => vi.advanceTimersByTime(10000));
  expect(screen.getByText('Saving your alert…')).toBeTruthy();
  expect(services.saveEmergencyAlert).not.toHaveBeenCalled();
  const result = { location: { latitude: 28.6, longitude: 77.2 }, hospitals: [{ name: 'Example hospital' }], locationStatus: 'ready', hospitalStatus: 'ready' };
  await act(async () => finish(result));
  expect(services.saveEmergencyAlert).toHaveBeenCalledWith('p1', expect.anything(), result);
});
it('does not send a cancelled event when its delayed lookup finishes', async () => {
  let finish;
  services.prepareNearby.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await start();
  await act(async () => screen.getByRole('button', { name: /Cancel —/ }).click());
  await act(async () => { finish(denied); await vi.advanceTimersByTime(20000); });
  expect(services.saveEmergencyAlert).not.toHaveBeenCalled();
});
it('does not send if the patient session ends during countdown', async () => {
  await start(); cleanup();
  await act(async () => vi.advanceTimersByTime(20000));
  expect(services.saveEmergencyAlert).not.toHaveBeenCalled();
});
it('reuses a recent lookup for 30 seconds to respect public service limits', async () => {
  services.prepareNearby.mockResolvedValue({ location: { latitude: 28.6, longitude: 77.2 }, hospitals: [], locationStatus: 'ready', hospitalStatus: 'empty' });
  await start();
  await act(async () => screen.getByRole('button', { name: /Cancel —/ }).click());
  await act(async () => screen.getByRole('button', { name: 'Start SOS' }).click());
  expect(services.prepareNearby).toHaveBeenCalledTimes(1);
});
it('does not cache failed lookups when the user retries', async () => {
  await start();
  await act(async () => screen.getByRole('button', { name: /Cancel —/ }).click());
  await act(async () => screen.getByRole('button', { name: 'Start SOS' }).click());
  expect(services.prepareNearby).toHaveBeenCalledTimes(2);
});
it('does not extend SOS preparation beyond 18 seconds when hospital servers are slow', async () => {
  const location = { latitude: 28.6, longitude: 77.2 };
  let finish;
  services.prepareNearby.mockImplementation(({ onProgress }) => {
    onProgress({ location, hospitals: [], locationStatus: 'ready', hospitalStatus: 'searching' });
    return new Promise((resolve) => { finish = resolve; });
  });
  await start();
  await act(async () => vi.advanceTimersByTime(18000));
  expect(services.saveEmergencyAlert).toHaveBeenCalledTimes(1);
  expect(services.saveEmergencyAlert.mock.calls[0][2]).toMatchObject({ location, hospitalStatus: 'unavailable' });
  const result = { location, hospitals: [{ name: 'Late result' }], locationStatus: 'ready', hospitalStatus: 'ready' };
  await act(async () => finish(result));
  expect(services.saveEmergencyAlert).toHaveBeenCalledTimes(1);
  expect(services.saveNearbySummary).toHaveBeenCalledWith('p1', result);
});
