import { afterEach, expect, it, vi } from 'vitest';
import hindi from './hi.json';
import { getLanguage, getLocale, isLanguage, setLanguage, t } from './i18n';
import { notifyAppointment, notifyDose } from './notifications';
afterEach(() => { setLanguage('en'); vi.unstubAllGlobals(); });
it('translates copy, preserves interpolation values and falls back without altering user data', () => {
  setLanguage('hi');
  expect(getLocale()).toBe('hi-IN');
  expect(t('Medicines')).toBe('दवाइयाँ');
  expect(t('{name}: dose recorded as taken.', { name: 'Medicines <script>' })).toBe('Medicines <script>: खुराक ली हुई दर्ज की गई।');
  expect(t('My private clinic')).toBe('My private clinic');
  expect(t({ key: '{error} Check your connection and try again.', values: { error: { key: 'Could not save the appointment change.' } } })).toContain('अपॉइंटमेंट का बदलाव');
  expect(isLanguage('fr')).toBe(false); setLanguage('fr'); expect(getLanguage()).toBe('hi');
});
it('keeps placeholder names consistent in every Hindi translation', () => {
  const variables = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [english, translated] of Object.entries(hindi)) {
    expect(translated.trim(), english).not.toBe('');
    expect(variables(translated), english).toEqual(variables(english));
  }
});
it('sends Hindi medicine and appointment notifications without translating medicine or clinic names', async () => {
  setLanguage('hi'); const showNotification = vi.fn().mockResolvedValue();
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('navigator', { serviceWorker: { register: vi.fn().mockResolvedValue(), ready: Promise.resolve({ showNotification }) } });
  await notifyDose({ id: 'm1', medicine: { name: 'Medicines', dose: '1 tablet' } });
  expect(showNotification).toHaveBeenLastCalledWith('CareLink दवाई का रिमाइंडर', expect.objectContaining({ lang: 'hi-IN', body: 'Medicines · 1 tablet। यह खुराक दर्ज करने के लिए CareLink खोलें।' }));
  await notifyAppointment({ id: 'a1', label: 'Upcoming appointment', appointment: { doctor: 'Doctor visit', scheduledAt: Date.now() } });
  const [title, options] = showNotification.mock.calls.at(-1);
  expect(title).toBe('CareLink · आने वाला अपॉइंटमेंट');
  expect(options.body).toContain('Doctor visit');
  expect(options.data.url).toBe('/patient/appointments');
});
