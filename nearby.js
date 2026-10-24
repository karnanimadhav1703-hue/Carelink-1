// Independent public Overpass services: one outage must not disable the map search.
export const OVERPASS_URLS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
export const HOSPITAL_TIMEOUT_MS = 30000;
export const PHOTON_URL = 'https://photon.komoot.io/reverse';
const FALLBACK_DELAY_MS = 4000;
const rateLimitedUntil = new Map();
export const validLocation = (point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)
  && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;

export function distanceKm(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function directionsUrl(hospital) {
  if (!validLocation(hospital)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}`;
}
export function locationMapUrl(location) {
  return validLocation(location) ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}` : null;
}
export function hospitalSearchUrl(location) {
  // A user-opened fallback; these results are not imported or called "nearest".
  return validLocation(location) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hospitals near ${location.latitude},${location.longitude}`)}` : null;
}
export function locationMessage(status) {
  return {
    denied: 'Location is blocked. You can allow it in browser site settings and try again. SOS can still save an alert without GPS.',
    timeout: 'Location took too long. Try again outdoors or near a window. SOS can still save an alert without GPS.',
    unavailable: 'Your location is unavailable. Check device location settings. SOS can still save an alert without GPS.',
    unsupported: 'This browser does not support location. SOS can still save an alert without GPS.',
  }[status] || '';
}
export function getLocation({ signal, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let timer;
    const finish = (error, result) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(Object.assign(new Error(error), { code: error })); else resolve(result);
    };
    const abort = () => finish('aborted');
    if (signal?.aborted) return abort();
    if (!globalThis.navigator?.geolocation) return finish('unsupported');
    signal?.addEventListener('abort', abort, { once: true });
    // This deadline also covers an unanswered browser permission prompt.
    timer = setTimeout(() => finish('timeout'), timeout);
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        capturedAt: position.timestamp || Date.now() };
      if (!validLocation(point)) finish('unavailable'); else finish(null, point);
    }, (error) => finish(({ 1: 'denied', 2: 'unavailable', 3: 'timeout' })[error.code] || 'unavailable'),
    { enableHighAccuracy: true, timeout, maximumAge: 0 });
  });
}

export function parseHospitals(data, location) {
  // Overpass may return partial results with a remark; never label those as complete.
  if (!Array.isArray(data?.elements) || data.remark) throw new Error('Hospital lookup was incomplete.');
  const seen = new Set();
  const hospitals = [];
  for (const element of data.elements) {
    if (element.tags?.amenity !== 'hospital' && element.tags?.healthcare !== 'hospital') continue;
    const point = { latitude: element.lat ?? element.center?.lat, longitude: element.lon ?? element.center?.lon };
    if (!validLocation(point)) continue;
    const distance = distanceKm(location, point);
    const id = `${element.type}/${element.id}`;
    if (distance > 5 || seen.has(id)) continue;
    seen.add(id);
    hospitals.push({ id, name: String(element.tags.name || element.tags['name:en'] || 'Hospital (name unavailable)').slice(0, 200), ...point, distanceKm: distance });
  }
  return hospitals.sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
}
export function parsePhotonHospitals(data, location) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid backup hospital response.');
  const elements = data.features.flatMap((feature) => {
    const properties = feature.properties || {};
    const type = { N: 'node', W: 'way', R: 'relation' }[properties.osm_type];
    if (!type || properties.osm_id == null || feature.geometry?.type !== 'Point'
      || !['amenity', 'healthcare'].includes(properties.osm_key) || properties.osm_value !== 'hospital') return [];
    const [lon, lat] = feature.geometry.coordinates || [];
    return [{ type, id: properties.osm_id, lat, lon, tags: { [properties.osm_key]: 'hospital', name: properties.name } }];
  });
  return parseHospitals({ elements }, location).map((hospital) => ({ ...hospital, source: 'photon' }));
}
export async function findHospitals(location, { signal } = {}) {
  if (!validLocation(location)) throw new Error('A valid location is required.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Hospital lookup cancelled.', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, HOSPITAL_TIMEOUT_MS);
  let startFallback;
  const fallbackGate = new Promise((resolve) => { startFallback = resolve; });
  const fallbackTimer = setTimeout(startFallback, FALLBACK_DELAY_MS);
  // body preserves node coordinates; center adds representative points for ways/relations.
  const query = `[out:json][timeout:20];(nwr["amenity"="hospital"](around:5000,${location.latitude},${location.longitude});nwr["healthcare"="hospital"](around:5000,${location.latitude},${location.longitude}););out body center;`;
  try {
    // Two Overpass attempts; a different OSM index is the backup if they are slow.
    // Take the first complete result, not the first HTTP reply.
    // Form-encoded POST avoids cached GET gateway errors and needs no CORS preflight.
    const overpass = Promise.any(OVERPASS_URLS.map(async (endpoint) => {
      if ((rateLimitedUntil.get(endpoint) || 0) > Date.now()) throw new Error('Hospital service is cooling down.');
      const response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), signal: controller.signal, credentials: 'omit' });
      if ([406, 429].includes(response.status)) {
        const retryAfter = response.headers?.get('Retry-After');
        const delay = Number(retryAfter) * 1000 || Date.parse(retryAfter) - Date.now() || 30000;
        rateLimitedUntil.set(endpoint, Date.now() + Math.max(30000, delay));
      }
      if (!response.ok) throw new Error('Hospital service is unavailable.');
      return parseHospitals(await response.json(), location);
    }));
    // Start early if both Overpass endpoints fail, otherwise give them four seconds.
    overpass.catch(startFallback);
    const fallback = fallbackGate.then(async () => {
      if (controller.signal.aborted) throw new DOMException('Lookup cancelled.', 'AbortError');
      const params = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), radius: '5', limit: '50' });
      params.append('osm_tag', 'amenity:hospital'); params.append('osm_tag', 'healthcare:hospital');
      const response = await fetch(`${PHOTON_URL}?${params}`, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Backup hospital service is unavailable.');
      return parsePhotonHospitals(await response.json(), location);
    });
    return await Promise.any([overpass, fallback]);
  } catch {
    if (signal?.aborted) throw new DOMException('Hospital lookup cancelled.', 'AbortError');
    throw new Error('Hospital services are unavailable or timed out.');
  } finally { abort(); clearTimeout(timer); clearTimeout(fallbackTimer); startFallback(); signal?.removeEventListener('abort', abort); }
}
export async function prepareNearby({ signal, locate = getLocation, search = findHospitals, onProgress } = {}) {
  let location;
  try { location = await locate({ signal }); }
  catch (error) { return { location: null, hospitals: [], locationStatus: error.code || 'unavailable', hospitalStatus: 'not-requested' }; }
  onProgress?.({ location, hospitals: [], locationStatus: 'ready', hospitalStatus: 'searching' });
  try {
    const hospitals = await search(location, { signal });
    return { location, hospitals, locationStatus: 'ready', hospitalStatus: hospitals.length ? 'ready' : 'empty' };
  } catch {
    return { location, hospitals: [], locationStatus: 'ready', hospitalStatus: 'unavailable' };
  }
}
export function nearbySnapshot(result) {
  return { location: result.location, nearestHospital: result.hospitals[0] || null,
    locationStatus: result.locationStatus, hospitalStatus: result.hospitalStatus };
}
