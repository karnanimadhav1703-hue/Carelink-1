// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
const root = new URL('../public/', import.meta.url);
function worker(fetch = vi.fn()) {
  const handlers = {};
  const offline = new Response('Offline · Call 112');
  const cache = { addAll: vi.fn().mockResolvedValue(), match: vi.fn().mockResolvedValue(offline) };
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(['carelink-public-old','unrelated']), delete: vi.fn().mockResolvedValue(true) };
  const self = { location: { origin: 'https://carelink.example' }, clients: { claim: vi.fn().mockResolvedValue() }, addEventListener: (name, handler) => { handlers[name] = handler; } };
  vm.runInNewContext(readFileSync(new URL('notifications-sw.js', root), 'utf8'), { self, caches, fetch, URL, Response });
  return { handlers, cache, caches, fetch, self };
}
it('has correctly sized install icons and standalone scope', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  expect(manifest).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL(icon.src.slice(1), root));
    const size = Number(icon.sizes.split('x')[0]);
    expect(png.readUInt32BE(16)).toBe(size); expect(png.readUInt32BE(20)).toBe(size);
  }
});
it('precaches only public assets and removes only its own obsolete caches', async () => {
  const w = worker(); let pending;
  w.handlers.install({ waitUntil: (promise) => { pending = promise; } }); await pending;
  expect(w.cache.addAll.mock.calls[0][0]).toEqual(['/offline.html','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-512.png']);
  w.handlers.activate({ waitUntil: (promise) => { pending = promise; } }); await pending;
  expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith('carelink-public-old');
});
it('uses the network for navigation and shows the public fallback on failure', async () => {
  const w = worker(vi.fn().mockRejectedValue(new Error('offline'))); let response;
  w.handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://carelink.example/patient/sos' }, respondWith: (promise) => { response = promise; } });
  expect(await (await response).text()).toContain('Call 112');
  expect(w.cache.match).toHaveBeenCalledWith('/offline.html');
});
it('never intercepts Firebase, Overpass, tiles, or non-navigation requests', () => {
  const w = worker(); const respondWith = vi.fn();
  for (const url of ['https://firestore.googleapis.com/v1/projects/demo', 'https://overpass-api.de/api/interpreter', 'https://tile.openstreetmap.org/1/0/0.png', 'https://carelink.example/assets/index.js']) w.handlers.fetch({ request: { method: 'GET', mode: 'cors', url }, respondWith });
  expect(respondWith).not.toHaveBeenCalled(); expect(w.caches.open).not.toHaveBeenCalled();
});
it('opens appointments from notification clicks and rejects arbitrary destinations', async () => {
  const w = worker();
  w.self.clients.matchAll = vi.fn().mockResolvedValue([]); w.self.clients.openWindow = vi.fn().mockResolvedValue();
  let pending;
  for (const url of ['/patient/appointments', 'https://untrusted.example/']) {
    w.handlers.notificationclick({ notification: { data: { url }, close: vi.fn() }, waitUntil: (promise) => { pending = promise; } }); await pending;
  }
  expect(w.self.clients.openWindow.mock.calls).toEqual([['/patient/appointments'], ['/patient/medicines']]);
});
