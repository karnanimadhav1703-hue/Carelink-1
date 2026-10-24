import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ state: null }));
vi.mock('../context/AppointmentContext', () => ({ useAppointments: () => mocks.state }));
vi.mock('../context/SpeechContext', () => ({ useScreenSpeech: vi.fn() }));
import AppointmentsPage from './AppointmentsPage';
beforeEach(() => { mocks.state = { appointments: [], ready: true, cached: false, now: Date.now(), busy: '', act: vi.fn(), save: vi.fn().mockResolvedValue('a1') }; });
afterEach(cleanup);
function show() { render(<MemoryRouter><AppointmentsPage /></MemoryRouter>); }
it('saves a calendar date/time in local time with the chosen reminder', async () => {
  show(); fireEvent.change(screen.getByLabelText('Doctor or clinic (optional)'), { target: { value: 'Example clinic' } });
  fireEvent.change(screen.getByLabelText('Visit date'), { target: { value: '2090-01-15' } });
  fireEvent.change(screen.getByLabelText('Visit time'), { target: { value: '10:30' } });
  fireEvent.change(screen.getByLabelText('Remind me'), { target: { value: '1440' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save appointment' }));
  await waitFor(() => expect(mocks.state.save).toHaveBeenCalledWith({ doctor: 'Example clinic', scheduledTime: new Date(2090, 0, 15, 10, 30).getTime(), reminderMinutes: 1440 }, null));
  expect(await screen.findByText(/Appointment saved/)).toBeTruthy();
});
it('rejects past dates and does not claim a failed save succeeded', async () => {
  show(); fireEvent.change(screen.getByLabelText('Visit date'), { target: { value: '2020-01-15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save appointment' }));
  expect(screen.getByRole('alert').textContent).toContain('future'); expect(mocks.state.save).not.toHaveBeenCalled();
  mocks.state.save.mockRejectedValue(new Error('offline'));
  fireEvent.change(screen.getByLabelText('Visit date'), { target: { value: '2090-01-15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save appointment' }));
  expect(await screen.findByText(/Appointment could not be saved/)).toBeTruthy();
  expect(screen.queryByText(/Appointment saved/)).toBeNull();
});
