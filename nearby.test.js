import { afterEach, expect, it, vi } from 'vitest';
import { directionsUrl, distanceKm, findHospitals, getLocation, hospitalSearchUrl, HOSPITAL_TIMEOUT_MS, OVERPASS_URLS, PHOTON_URL, parseHospitals, parsePhotonHospitals, prepareNearby } from './nearby';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const location = { latitude: 28.6139, longitude: 77.209 };
it('calculates straight-line distances and parses nodes and way centers, sorted within 5 km', () => {
  expect(distanceKm(location, location)).toBe(0);
  expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 2);
  const node = { type: 'node', id: 1, lat: 28.614, lon: 77.209, tags: { amenity: 'hospital', name: 'Nearest' } };
  const results = parseHospitals({ elements: [
    { type: 'way', id: 2, center: { lat: 28.63, lon: 77.21 }, tags: { healthcare: 'hospital', name: 'Second' } },
    node, node,
    { type: 'node', id: 3, lat: 29, lon: 77.2, tags: { amenity: 'hospital' } },
    { type: 'node', id: 4, tags: { amenity: 'hospital' } },
  ] }, location);
  expect(results.map((hospital) => hospital.name)).toEqual(['Nearest', 'Second']);
  expect(directionsUrl(results[0])).toContain('destination=28.614,77.209');
  expect(directionsUrl({ latitude: NaN, longitude: 0 })).toBeNull();
});
it('rejects partial Overpass results instead of reporting a misleading nearest hospital', () => {
  expect(() => parseHospitals({ elements: [], remark: 'runtime error' }, location)).toThrow('incomplete');
});
it('uses a bounded 5 km Overpass query and reports service failure', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal('fetch', fetch);
  await expect(findHospitals(location)).rejects.toThrow('unavailable');
  expect(fetch).toHaveBeenCalledTimes(3);
  const query = fetch.mock.calls[0][1].body.get('data');
  expect(query).toContain('around:5000,28.6139,77.209');
  expect(query).toContain('out body center;');
});
it('filters backup results to real OSM hospital tags, valid coordinates, and the 5 km radius', () => {
  const feature = { properties: { osm_type: 'N', osm_id: 1, osm_key: 'amenity', osm_value: 'hospital', name: 'Backup hospital' }, geometry: { type: 'Point', coordinates: [77.209, 28.614] } };
  const result = parsePhotonHospitals({ type: 'FeatureCollection', features: [feature, feature,
    { ...feature, properties: { ...feature.properties, osm_id: 2, osm_value: 'pharmacy' } },
    { ...feature, geometry: { type: 'Point', coordinates: [78, 29] } },
  ] }, location);
  expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ id: 'node/1', name: 'Backup hospital', source: 'photon' });
  expect(() => parsePhotonHospitals({ error: 'invalid query' }, location)).toThrow();
});
it('uses the independent backup when both Overpass services fail', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) });
  vi.stubGlobal('fetch', fetch);
  expect(await findHospitals(location)).toEqual([]);
  const url = new URL(fetch.mock.calls[2][0]);
  expect(url.origin + url.pathname).toBe(PHOTON_URL); expect(url.searchParams.get('radius')).toBe('5');
  expect(url.searchParams.getAll('osm_tag')).toEqual(['amenity:hospital', 'healthcare:hospital']);
});
it('starts the backup after four seconds and aborts slow Overpass requests when it wins', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn((url, { signal }) => url.startsWith(PHOTON_URL)
    ? Promise.resolve({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) })
    : new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))));
  vi.stubGlobal('fetch', fetch);
  const result = findHospitals(location); expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(4000);
  expect(await result).toEqual([]); expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
it('accepts a complete fallback result when the other server returns invalid or partial data', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [], remark: 'timeout' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [{ type: 'node', id: 1, lat: 28.614, lon: 77.209, tags: { amenity: 'hospital', name: 'Actual response' } }] }) });
  vi.stubGlobal('fetch', fetch);
  expect((await findHospitals(location))[0].name).toBe('Actual response');
  expect(fetch.mock.calls.map(([url]) => url.split('?')[0])).toEqual(OVERPASS_URLS);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
it('does not wait for a hung server after a valid empty result arrives', async () => {
  let stopped = false;
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce((_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { stopped = true; reject(new DOMException('cancelled', 'AbortError')); });
  })).mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [] }) }));
  expect(await findHospitals(location)).toEqual([]); expect(stopped).toBe(true);
});
it('bounds both requests by one deadline and cancels both on navigation', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))));
  vi.stubGlobal('fetch', fetch);
  const failed = expect(findHospitals(location)).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(HOSPITAL_TIMEOUT_MS); await failed;
  expect(fetch.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
  const controller = new AbortController();
  const cancelled = expect(findHospitals(location, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await cancelled;
  fetch.mockClear();
  await expect(findHospitals(location, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).not.toHaveBeenCalled();
});
it('publishes captured GPS while hospitals are still loading and provides a user-opened Maps fallback', async () => {
  let finish; const onProgress = vi.fn();
  const request = prepareNearby({ locate: async () => location, search: () => new Promise((resolve) => { finish = resolve; }), onProgress });
  await Promise.resolve();
  expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ location, hospitalStatus: 'searching' }));
  finish([]); await request;
  expect(new URL(hospitalSearchUrl(location)).searchParams.get('query')).toBe('hospitals near 28.6139,77.209');
  expect(hospitalSearchUrl(null)).toBeNull();
});
it('respects server rate limits while allowing the other service on retry', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '30' }) })
    .mockResolvedValue({ ok: true, json: async () => ({ elements: [] }) });
  vi.stubGlobal('fetch', fetch);
  await findHospitals(location); fetch.mockClear();
  await findHospitals(location);
  expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toBe(OVERPASS_URLS[1]);
  await vi.advanceTimersByTimeAsync(31000); fetch.mockClear();
  await findHospitals(location); expect(fetch).toHaveBeenCalledTimes(2);
});
it('returns a denied-location state without querying hospitals', async () => {
  const search = vi.fn();
  const result = await prepareNearby({ locate: vi.fn().mockRejectedValue({ code: 'denied' }), search });
  expect(result).toMatchObject({ location: null, locationStatus: 'denied', hospitals: [] });
  expect(search).not.toHaveBeenCalled();
});
it('retains GPS if hospitals fail and distinguishes a successful empty search', async () => {
  const locate = vi.fn().mockResolvedValue(location);
  expect(await prepareNearby({ locate, search: vi.fn().mockRejectedValue(new Error('timeout')) })).toMatchObject({ location, hospitalStatus: 'unavailable' });
  expect(await prepareNearby({ locate, search: vi.fn().mockResolvedValue([]) })).toMatchObject({ location, hospitalStatus: 'empty' });
});
it('handles denied GPS and imposes a deadline even on an unanswered permission prompt', async () => {
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_, failure) => failure({ code: 1 }) } });
  await expect(getLocation()).rejects.toMatchObject({ code: 'denied' });
  vi.useFakeTimers();
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } });
  const request = getLocation();
  const assertion = expect(request).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(8000);
  await assertion;
});
it('cleans up an aborted location request', async () => {
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn() } });
  const controller = new AbortController();
  const request = getLocation({ signal: controller.signal });
  controller.abort();
  await expect(request).rejects.toMatchObject({ code: 'aborted' });
});
