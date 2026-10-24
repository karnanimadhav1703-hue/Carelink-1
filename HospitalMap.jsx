import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function HospitalMap({ location, hospitals }) {
  const { language } = useLanguage();
  const container = useRef(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!location) return;
    setTileError(false);
    const map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false }).setView([location.latitude, location.longitude], 14);
    L.control.zoom({ zoomInTitle: t('Zoom in'), zoomOutTitle: t('Zoom out') }).addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    const label = (text) => { const element = document.createElement('span'); element.textContent = text; return element; };
    L.circleMarker([location.latitude, location.longitude], { radius: 10, color: '#fff', fillColor: '#174bb3', fillOpacity: 1, weight: 3 }).addTo(map).bindPopup(label(t('Your GPS location')));
    for (const hospital of hospitals) L.circleMarker([hospital.latitude, hospital.longitude], { radius: 8, color: '#fff', fillColor: '#8c1b26', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup(label(hospital.name));
    const points = [[location.latitude, location.longitude], ...hospitals.map((hospital) => [hospital.latitude, hospital.longitude])];
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => map.invalidateSize()) : null;
    observer?.observe(container.current);
    return () => { observer?.disconnect(); tiles.off(); map.remove(); };
  }, [location, hospitals, language]);
  return <div className="map-panel">
    <p id="hospital-map-description">{hospitals.length ? t("Blue: your location. Red: hospitals. The accessible list below has the same hospitals and directions.") : t("Blue: your location. No hospital markers are available yet.")}</p>
    <div ref={container} className="hospital-map" role="region" aria-label={t("Nearby hospital map")} aria-describedby="hospital-map-description" />
    {tileError && <p role="status">{t("Some map tiles could not load. The hospital list and directions still work.")}</p>}
  </div>;
}
