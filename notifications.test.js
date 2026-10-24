import { afterEach, expect, it, vi } from 'vitest';
import { enableNotifications, notifyAppointment, notifyDose } from './notifications';
afterEach(() => vi.unstubAllGlobals());
it('explains unsupported browsers without asking permission', async () => {
  vi.stubGlobal('navigator', {});
  expect(await enableNotifications()).toContain('unavailable');
});
it('handles denied permission without prompting again', async () => {
  const requestPermission = vi.fn();
  vi.stubGlobal('Notification', { permission: 'denied', requestPermission });
  vi.stubGlobal('navigator', { serviceWorker: {} });
  expect(await enableNotifications()).toContain('blocked');
  expect(requestPermission).not.toHaveBeenCalled();
});
it('keeps in-app reminders when permission is dismissed', async () => {
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('default') });
  vi.stubGlobal('navigator', { serviceWorker: {} });
  expect(await enableNotifications()).toContain('In-app reminders still work');
});
it('uses persistent service-worker notifications with a stable dose tag', async () => {
  const showNotification = vi.fn().mockResolvedValue();
  const register = vi.fn().mockResolvedValue();
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') });
  vi.stubGlobal('navigator', { serviceWorker: { register, ready: Promise.resolve({ showNotification }) } });
  expect(await enableNotifications()).toContain('enabled');
  await notifyDose({ id: 'm1_123', demo: true, medicine: { name: 'Example', dose: 'Practice' } });
  expect(showNotification).toHaveBeenCalledWith('CareLink demo reminder', expect.objectContaining({ tag: 'm1_123', data: { url: '/patient/medicines' } }));
});
it('routes an appointment notification to appointments with its own stable tag', async () => {
  const showNotification = vi.fn().mockResolvedValue();
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockResolvedValue(), ready: Promise.resolve({ showNotification }) } });
  await notifyAppointment({ id: 'a1:1:due', label: 'Appointment time reached', appointment: { doctor: 'Example clinic', scheduledAt: Date.now() } });
  expect(showNotification).toHaveBeenCalledWith('CareLink · Appointment time reached', expect.objectContaining({ tag: 'appointment:a1:1:due', data: { url: '/patient/appointments' } }));
});
