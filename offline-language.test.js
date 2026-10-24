// @vitest-environment node
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
it('uses the saved Hindi choice offline and keeps the emergency link when switching back', () => {
  const html = readFileSync(new URL('../public/offline.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://carelink.example/', runScripts: 'dangerously', beforeParse(window) { window.localStorage.setItem('carelink-language', 'hi'); } });
  const doc = dom.window.document;
  expect(doc.documentElement.lang).toBe('hi');
  expect(doc.getElementById('offline-title').textContent).toBe('आप ऑफ़लाइन हैं');
  expect(doc.getElementById('offline-call').getAttribute('href')).toBe('tel:112');
  const select = doc.getElementById('offline-language'); select.value = 'en'; select.dispatchEvent(new dom.window.Event('change'));
  expect(doc.getElementById('offline-title').textContent).toBe('You’re offline');
  expect(dom.window.localStorage.getItem('carelink-language')).toBe('en');
  dom.window.close();
});
