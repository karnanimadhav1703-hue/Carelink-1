// A real network smoke test using public Jaipur city-centre coordinates, never device GPS.
import { findHospitals } from '../src/lib/nearby.js';
// Browsers send Origin/Referer automatically. Identify this CLI smoke test too.
const networkFetch = globalThis.fetch;
globalThis.fetch = (url, options) => networkFetch(url, { ...options, headers: {
  'User-Agent': 'CareLink/0.1 (https://care-link-f876a.web.app)',
  Origin: 'https://care-link-f876a.web.app', Referer: 'https://care-link-f876a.web.app/',
} });
const start = Date.now();
try {
  const hospitals = await findHospitals({ latitude: 26.9124, longitude: 75.7873 });
  if (!hospitals.length || hospitals.some((hospital, index) => hospital.distanceKm > 5 || (index && hospital.distanceKm < hospitals[index - 1].distanceKm))) throw new Error('Expected nearby hospitals in distance order.');
  console.log(JSON.stringify({ success: true, elapsedMs: Date.now() - start, count: hospitals.length,
    nearest: hospitals.slice(0, 3).map(({ name, distanceKm }) => ({ name, distanceKm: Number(distanceKm.toFixed(2)) })) }, null, 2));
} catch (error) { console.error(`Live hospital check failed: ${error.message}`); process.exitCode = 1; }
