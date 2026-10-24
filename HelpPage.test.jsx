import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ emergency: null }));
vi.mock('../context/EmergencyContext', () => ({ useEmergency: () => mocks.emergency }));
vi.mock('../context/SpeechContext', () => ({ useScreenSpeech: vi.fn() }));
vi.mock('../components/HospitalMap', () => ({ default: () => <div>Map with captured GPS</div> }));
import HelpPage from './HelpPage';
afterEach(cleanup);
function show(status, locating = false) {
  mocks.emergency = { locating, syncError: '', refreshNearby: vi.fn(), nearby: { location: { latitude: 26.9124, longitude: 75.7873, capturedAt: Date.now(), accuracy: 25 }, hospitals: [], locationStatus: 'ready', hospitalStatus: status } };
  render(<MemoryRouter><HelpPage /></MemoryRouter>);
}
it('keeps the map and a direct hospital search available after a service failure', async () => {
  show('unavailable');
  expect(await screen.findByText('Map with captured GPS')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Search hospitals in Google Maps/ }).getAttribute('href')).toContain('hospitals%20near%2026.9124');
  expect(screen.getByRole('link', { name: /Call 112/ }).getAttribute('href')).toBe('tel:112');
  expect(screen.getByRole('button', { name: 'Find hospitals near me' }).disabled).toBe(false);
});
it('shows captured GPS during the search without prematurely claiming failure or no results', async () => {
  show('searching', true);
  expect(await screen.findByText('Map with captured GPS')).toBeTruthy();
  expect(screen.getByText(/Your location is ready/)).toBeTruthy();
  expect(screen.queryByText(/did not respond/)).toBeNull();
  expect(screen.queryByText(/No hospitals were returned/)).toBeNull();
  expect(screen.getByRole('button', { name: /Finding your location/ }).disabled).toBe(true);
});
