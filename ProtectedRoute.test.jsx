import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
afterEach(cleanup);

function openPatient(state) {
  useAuth.mockReturnValue({ loading: false, error: '', user: null, profile: null, ...state });
  render(<MemoryRouter initialEntries={['/patient']}><Routes>
    <Route path="/login" element={<p>Login screen</p>} />
    <Route path="/family" element={<p>Family screen</p>} />
    <Route path="/choose-mode" element={<p>Mode chooser</p>} />
    <Route element={<ProtectedRoute role="patient" />}><Route path="/patient" element={<p>Patient screen</p>} /></Route>
  </Routes></MemoryRouter>);
}

describe('role-protected routes', () => {
  it('redirects signed-out visitors to login', () => {
    openPatient({});
    expect(screen.getByText('Login screen')).toBeTruthy();
  });
  it('does not redirect while the auth/profile request is loading', () => {
    openPatient({ loading: true });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('Patient screen')).toBeNull();
  });
  it('sends family users to their own route', () => {
    openPatient({ user: { uid: 'son' }, profile: { role: 'family' } });
    expect(screen.getByText('Family screen')).toBeTruthy();
  });
  it('lets patients open the patient route', () => {
    openPatient({ user: { uid: 'meena' }, profile: { role: 'patient', mode: 'standard', modeSelected: true } });
    expect(screen.getByText('Patient screen')).toBeTruthy();
  });
  it('sends an account without a profile to profile completion', () => {
    openPatient({ user: { uid: 'meena' } });
    expect(screen.getByText('Login screen')).toBeTruthy();
  });
  it('shows a database failure without exposing protected content', () => {
    openPatient({ user: { uid: 'meena' }, error: 'Profile unavailable' });
    expect(screen.getByRole('alert').textContent).toBe('Profile unavailable');
    expect(screen.queryByText('Patient screen')).toBeNull();
  });
  it('requires an explicit choice for an existing Stage 1 profile', () => {
    openPatient({ user: { uid: 'meena' }, profile: { role: 'patient', mode: 'standard' } });
    expect(screen.getByText('Mode chooser')).toBeTruthy();
  });
  it('recovers an invalid saved mode through the chooser', () => {
    openPatient({ user: { uid: 'meena' }, profile: { role: 'patient', mode: 'invalid', modeSelected: true } });
    expect(screen.getByText('Mode chooser')).toBeTruthy();
  });
});
