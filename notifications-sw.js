// Keep this URL: existing notification registrations upgrade to the same PWA worker.
// Cache only public fallback assets. Never cache health records, API calls, or map tiles.
const CACHE = 'carelink-public-v5';
const PUBLIC_ASSETS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_ASSETS)));
  // No skipWaiting: installing an update must not interrupt an active countdown.
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('carelink-public-') && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match('/offline.html') || new Response('CareLink is offline. Reconnect to continue. For an emergency, call 112. / CareLink ऑफ़लाइन है। इंटरनेट से जुड़ें। आपात स्थिति में 112 पर कॉल करें।', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }));
  }
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    // Only allow known internal destinations, never arbitrary notification URLs.
    const destination = event.notification.data?.url === '/patient/appointments' ? '/patient/appointments' : '/patient/medicines';
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(destination); return existing.focus(); }
    return self.clients.openWindow(destination);
  })());
});
