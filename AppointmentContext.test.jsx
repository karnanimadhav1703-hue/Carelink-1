import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ notify: vi.fn(), speak: vi.fn() }));
vi.mock('../lib/notifications', () => ({ notifyAppointment: mocks.notify }));
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { uid: 'p1' }, profile: { role: 'patient' } }) }));
vi.mock('./ModeContext', () => ({ useMode: () => ({ mode: 'vision-assist' }) }));
vi.mock('./SpeechContext', () => ({ useSpeech: () => ({ speak: mocks.speak }) }));
import { AppointmentProvider } from './AppointmentContext';
import AppointmentReminders from '../components/AppointmentReminders';
let listener; let services; let stop;
const now = new Date(2027, 0, 15, 9).getTime();
const appointment = { id: 'a1', patientId: 'p1', doctor: 'Demo clinic', scheduledAt: now + 7200000, reminderMinutes: 60, revision: 1, status: 'scheduled', demoAt: now + 60000 };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.clearAllMocks(); sessionStorage.clear(); mocks.notify.mockResolvedValue();
  stop = vi.fn(); services = { watchAppointments: (_, callback) => { listener = callback; return stop; }, updateAppointment: vi.fn().mockResolvedValue(true) };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
function show() { return render(<MemoryRouter><AppointmentProvider services={services}><AppointmentReminders /></AppointmentProvider></MemoryRouter>); }
it('announces a one-minute demo only once, reads it aloud, and persists dismissal', async () => {
  show(); act(() => listener({ records: [appointment], fromCache: false }));
  await act(async () => vi.advanceTimersByTime(60000));
  expect(screen.getByText('Appointment reminder')).toBeTruthy(); expect(mocks.notify).toHaveBeenCalledTimes(1); expect(mocks.speak).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(20000)); expect(mocks.notify).toHaveBeenCalledTimes(1);
  await act(async () => screen.getByRole('button', { name: /Dismiss Demo/ }).click());
  expect(services.updateAppointment).toHaveBeenCalledWith('p1', 'a1', 'acknowledge', expect.objectContaining({ kind: `demo_${appointment.demoAt}` }));
  act(() => listener({ records: [{ ...appointment, acknowledged: { [`demo_${appointment.demoAt}`]: true } }], fromCache: false }));
  expect(screen.queryByText('Appointment reminder')).toBeNull();
  cleanup(); expect(stop).toHaveBeenCalledOnce();
});
it('does not announce cached schedules and suppresses cancelled visits', async () => {
  show(); act(() => listener({ records: [{ ...appointment, demoAt: now }], fromCache: true }));
  expect(mocks.notify).not.toHaveBeenCalled();
  act(() => listener({ records: [{ ...appointment, demoAt: now, status: 'cancelled' }], fromCache: false }));
  expect(screen.queryByText('Appointment reminder')).toBeNull();
});
it('keeps the reminder when dismissal fails and does not replay after remount', async () => {
  services.updateAppointment.mockRejectedValueOnce(new Error('offline'));
  show(); act(() => listener({ records: [{ ...appointment, demoAt: now }], fromCache: false }));
  await act(async () => screen.getByRole('button', { name: /Dismiss Demo/ }).click());
  expect(screen.getByText(/offline Check your connection/)).toBeTruthy();
  expect(screen.getByText('Appointment reminder')).toBeTruthy();
  cleanup(); show(); act(() => listener({ records: [{ ...appointment, demoAt: now }], fromCache: false }));
  expect(mocks.notify).toHaveBeenCalledTimes(1);
});
