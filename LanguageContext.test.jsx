import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { LanguageProvider } from './LanguageContext';
import { ModeProvider } from './ModeContext';
import { SpeechProvider } from './SpeechContext';
import { AppointmentContext } from './AppointmentContext';
import { LANGUAGE_KEY, setLanguage, t } from '../lib/i18n';
import LanguageSelector from '../components/LanguageSelector';
import SpeechControls from '../components/SpeechControls';
import AppointmentsPage from '../pages/AppointmentsPage';
import FamilyPage from '../pages/FamilyPage';

const patient = { name: 'Meena', role: 'patient', mode: 'standard', modeSelected: true };
const appointments = { appointments: [], ready: true, cached: false, now: Date.now(), busy: '', act: vi.fn(), save: vi.fn() };
function Harness({ profile = patient, user = { uid: 'p1' }, save = async () => {}, children }) {
  return <MemoryRouter><AuthContext.Provider value={{ user, profile }}><LanguageProvider saveLanguage={save}><ModeProvider><SpeechProvider>
    <LanguageSelector /><AppointmentContext.Provider value={appointments}>{children || <AppointmentsPage />}</AppointmentContext.Provider><SpeechControls />
  </SpeechProvider></ModeProvider></LanguageProvider></AuthContext.Provider></MemoryRouter>;
}
beforeEach(() => { localStorage.clear(); setLanguage('en'); });
afterEach(() => { cleanup(); setLanguage('en'); vi.unstubAllGlobals(); });
it('switches a guest interface immediately and remembers the device choice across remounts', () => {
  const save = vi.fn();
  render(<Harness user={null} profile={null} save={save} />);
  fireEvent.change(screen.getByLabelText('Language / भाषा'), { target: { value: 'hi' } });
  expect(screen.getByRole('heading', { name: 'अपॉइंटमेंट', level: 1 })).toBeTruthy();
  expect(document.documentElement.lang).toBe('hi');
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe('hi');
  expect(save).not.toHaveBeenCalled();
  cleanup(); render(<Harness user={null} profile={null} />);
  expect(screen.getByLabelText('Language / भाषा').value).toBe('hi');
});
it('restores the profile language and saves only an explicit language change', async () => {
  const save = vi.fn().mockResolvedValue();
  render(<Harness profile={{ ...patient, language: 'hi' }} save={save} />);
  expect(screen.getByRole('button', { name: 'अपॉइंटमेंट सहेजें' })).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Language / भाषा'), { target: { value: 'en' } });
  await screen.findByText('Language saved to your profile.');
  expect(save).toHaveBeenCalledWith('p1', 'en');
  expect(screen.getByRole('button', { name: 'Save appointment' })).toBeTruthy();
});
it('keeps the local choice and explains a failed profile save', async () => {
  render(<Harness save={async () => { throw new Error('offline'); }} />);
  fireEvent.change(screen.getByLabelText('Language / भाषा'), { target: { value: 'hi' } });
  await screen.findByText(t('Language changed on this device. Your profile could not be updated; reconnect and choose the language again.'));
  expect(screen.queryByText(t('Language saved to your profile.'))).toBeNull();
  expect(screen.getByLabelText('Language / भाषा').disabled).toBe(false);
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe('hi');
});
it('preserves unsaved clinical text and time fields while switching both ways', async () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Doctor or clinic (optional)'), { target: { value: 'Medicines' } });
  fireEvent.change(screen.getByLabelText('Visit date'), { target: { value: '2090-11-05' } });
  fireEvent.change(screen.getByLabelText('Visit time'), { target: { value: '14:30' } });
  fireEvent.change(screen.getByLabelText('Language / भाषा'), { target: { value: 'hi' } });
  await waitFor(() => expect(screen.getByLabelText('Language / भाषा').disabled).toBe(false));
  expect(screen.getByLabelText('डॉक्टर या क्लिनिक (वैकल्पिक)').value).toBe('Medicines');
  expect(screen.getByLabelText('मुलाकात की तारीख').value).toBe('2090-11-05');
  expect(screen.getByLabelText('मुलाकात का समय').value).toBe('14:30');
  expect(screen.getByRole('option', { name: '1 घंटा पहले' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Language / भाषा'), { target: { value: 'en' } });
  expect(screen.getByLabelText('Doctor or clinic (optional)').value).toBe('Medicines');
});
it('supports family accounts and translates their live dashboard controls', async () => {
  const services = { watchFamilyConnections: (_, callback) => { callback({ records: [], fromCache: false }); return () => {}; } };
  render(<Harness profile={{ name: 'Arjun', role: 'family', language: 'hi' }}><FamilyPage services={services} /></Harness>);
  expect(screen.getByRole('button', { name: 'मरीज़ को जोड़ें' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /112 पर कॉल करें/ }).getAttribute('href')).toBe('tel:112');
  expect(screen.getByRole('heading', { name: /Arjun/ })).toBeTruthy();
});
it('reads translated summaries with a Hindi voice and uses text when that voice is unavailable', async () => {
  const spoken = vi.fn(); const hindi = { name: 'Hindi', lang: 'hi-IN' };
  vi.stubGlobal('speechSynthesis', { speak: spoken, cancel: vi.fn(), getVoices: () => [hindi] });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
  render(<Harness profile={{ ...patient, mode: 'vision-assist', language: 'hi' }} />);
  await waitFor(() => expect(spoken.mock.calls.at(-1)[0].lang).toBe('hi-IN'));
  expect(spoken.mock.calls.at(-1)[0].text).toContain('डॉक्टर से मुलाकात');
  expect(spoken.mock.calls.at(-1)[0].voice).toBe(hindi);
  cleanup(); spoken.mockClear();
  vi.stubGlobal('speechSynthesis', { speak: spoken, cancel: vi.fn(), getVoices: () => [{ lang: 'en-US' }] });
  render(<Harness profile={{ ...patient, mode: 'vision-assist', language: 'hi' }} />);
  expect(spoken).not.toHaveBeenCalled();
  expect(screen.getByText(t('Audio is unavailable for this language on your device. The screen summary is written below.'))).toBeTruthy();
  expect(screen.getByText(/अपॉइंटमेंट। डॉक्टर से मुलाकात/)).toBeTruthy();
});
it('ignores a late save response from a signed-out account', async () => {
  let finish;
  const rendered = render(<Harness save={() => new Promise((resolve) => { finish = resolve; })} />);
  fireEvent.change(screen.getByLabelText('Language / भाषा'), { target: { value: 'hi' } });
  rendered.rerender(<Harness user={null} profile={null} />);
  await act(async () => finish());
  expect(screen.queryByText(t('Language saved to your profile.'))).toBeNull();
  expect(screen.getByLabelText('Language / भाषा').disabled).toBe(false);
});
