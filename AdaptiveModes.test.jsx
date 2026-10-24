import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ModeProvider, useMode } from '../context/ModeContext';
import { SpeechProvider, useScreenSpeech } from '../context/SpeechContext';
import ModeForm from './ModeForm';
import SpeechControls from './SpeechControls';

vi.mock('../lib/database', () => ({ savePatientMode: vi.fn(), watchUserProfile: vi.fn() }));
let spoken;
let cancel;
beforeEach(() => {
  spoken = vi.fn(); cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak: spoken, cancel });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Harness({ mode = 'standard', save = async () => {}, showForm = true }) {
  const [profile, setProfile] = useState({ name: 'Meena', role: 'patient', mode, modeSelected: true });
  return <MemoryRouter><AuthContext.Provider value={{ user: { uid: 'meena' }, profile }}>
    <ModeProvider><SpeechProvider><Content showForm={showForm} saveMode={async (uid, selected) => {
      await save(uid, selected);
      setProfile((previous) => ({ ...previous, mode: selected }));
    }} /></SpeechProvider></ModeProvider>
  </AuthContext.Provider></MemoryRouter>;
}
function Content({ saveMode, showForm }) {
  const { mode } = useMode();
  useScreenSpeech('Settings', 'Settings. Choose a mode, then save.');
  return <div data-testid="mode" data-mode={mode}>
    {showForm && <ModeForm saveMode={saveMode} />}<SpeechControls />
  </div>;
}

describe('adaptive mode interactions', () => {
  it('previews without a database write and saves only the selected mode', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Harness save={save} />);
    fireEvent.click(screen.getByRole('radio', { name: /Elderly/ }));
    expect(screen.getByTestId('mode').dataset.mode).toBe('elderly');
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save mode' }));
    await screen.findByText('Your mode is saved to your profile.');
    expect(save).toHaveBeenCalledWith('meena', 'elderly');
    expect(screen.getByTestId('mode').dataset.mode).toBe('elderly');
  });
  it('keeps failed saves editable and does not report success', async () => {
    render(<Harness save={async () => { throw { code: 'permission-denied' }; }} />);
    fireEvent.click(screen.getByRole('radio', { name: /Elderly/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save mode' }));
    expect((await screen.findByRole('alert')).textContent).toContain('has not been saved');
    expect(screen.queryByText('Your mode is saved to your profile.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save mode' }).disabled).toBe(false);
  });
  it('never announces success while the database write is pending', async () => {
    let finish;
    render(<Harness save={() => new Promise((resolve) => { finish = resolve; })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save mode' }));
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true);
    expect(screen.queryByText('Your mode is saved to your profile.')).toBeNull();
    finish();
    await screen.findByText('Your mode is saved to your profile.');
  });
  it('automatically reads vision-assist screens and supports replay and stop', async () => {
    const rendered = render(<Harness mode="vision-assist" showForm={false} />);
    await waitFor(() => expect(spoken).toHaveBeenCalledTimes(1));
    expect(spoken.mock.calls[0][0].text).toContain('Settings. Choose a mode');
    fireEvent.click(screen.getByRole('button', { name: 'Read this screen' }));
    expect(spoken).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }));
    expect(cancel).toHaveBeenCalled();
    const count = cancel.mock.calls.length;
    rendered.unmount();
    expect(cancel.mock.calls.length).toBeGreaterThan(count);
  });
  it('does not auto-read standard or elderly mode', () => {
    render(<Harness mode="elderly" showForm={false} />);
    expect(spoken).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Read this screen' })).toBeNull();
  });
  it('keeps the summary readable when browser speech is unavailable', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    delete window.SpeechSynthesisUtterance;
    render(<Harness mode="vision-assist" showForm={false} />);
    expect(screen.getByText('Settings. Choose a mode, then save.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Audio is unavailable');
    expect(screen.getByRole('button', { name: 'Read this screen' }).disabled).toBe(true);
  });
});
