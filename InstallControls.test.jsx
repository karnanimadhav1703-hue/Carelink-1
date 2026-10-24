import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import InstallControls from './InstallControls';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('provides installation instructions without a native prompt', () => {
  render(<InstallControls />);
  expect(screen.getByText(/In Chrome or Edge/).textContent).toContain('Safari');
  expect(screen.queryByRole('button', { name: 'Install CareLink' })).toBeNull();
});
it('requests installation only on a click and handles dismissal', async () => {
  render(<InstallControls />);
  const offer = new Event('beforeinstallprompt', { cancelable: true });
  offer.prompt = vi.fn().mockResolvedValue(); offer.userChoice = Promise.resolve({ outcome: 'dismissed' });
  act(() => window.dispatchEvent(offer));
  expect(offer.defaultPrevented).toBe(true); expect(offer.prompt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Install CareLink' }));
  expect(await screen.findByText(/You can install later/)).toBeTruthy();
  expect(offer.prompt).toHaveBeenCalledOnce();
  act(() => window.dispatchEvent(new Event('appinstalled')));
  expect(screen.queryByText('Install CareLink on your device')).toBeNull();
});
it('explains lost connectivity and removes the notice on reconnection', () => {
  vi.stubGlobal('navigator', { onLine: true }); render(<InstallControls />);
  navigator.onLine = false; act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByRole('status').textContent).toContain('offline');
  navigator.onLine = true; act(() => window.dispatchEvent(new Event('online')));
  expect(screen.queryByRole('status')).toBeNull();
});
