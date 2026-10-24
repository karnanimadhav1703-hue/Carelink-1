import { useLanguage } from '../context/LanguageContext';
import { t, getLocale } from '../lib/i18n';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useEmergency } from '../context/EmergencyContext';
import { useScreenSpeech } from '../context/SpeechContext';
import { directionsUrl, hospitalSearchUrl, locationMessage } from '../lib/nearby';
const HospitalMap = lazy(() => import('../components/HospitalMap'));

export default function HelpPage() {
  useLanguage();
  const { nearby, locating, syncError, refreshNearby } = useEmergency();
  const { location, hospitals, locationStatus, hospitalStatus } = nearby;
  useScreenSpeech('Help Near Me', 'Help Near Me. For an emergency, call 112. Select Find hospitals near me to use your GPS location and search within five kilometres. Location and the nearest result are saved for family. Results do not confirm emergency services or availability.');
  return <section className="care-page help-page">
    <Link className="back-link" to="/patient">{t("← Back to home")}</Link>
    <p className="eyebrow">{t("HELP CLOSE BY")}</p><h1>{t("Help Near Me")}</h1>
    <p className="page-intro">{t("Find hospitals listed within 5 km of your GPS location.")}</p>
    <a className="emergency-button" href="tel:112">{t("Call 112 ")}<span>{t("Emergency assistance")}</span></a>
    <div className="feature-notice"><p>{t("Distances are straight-line estimates. OpenStreetMap results may be incomplete or outdated. A listing does not confirm emergency care, opening hours, or bed availability.")}</p>
      <p>{t("Finding hospitals shares your coordinates with Overpass and, if needed, Photon’s OpenStreetMap search, and saves your location and nearest result in CareLink for family. Directions opens Google Maps. Successful searches are reused for 30 seconds.")}</p>
      <button className="button" onClick={() => void refreshNearby()} disabled={locating}>{locating ? t("Finding your location and hospitals…") : t("Find hospitals near me")}</button>
    </div>
    {locating && <p role="status" className="feature-notice">{location ? t("Your location is ready. Searching for hospitals…") : t("Looking up GPS and hospitals…")}{t(" This may take up to about 40 seconds. You can call 112 at any time.")}</p>}
    {locationMessage(locationStatus) && <p role="status" className="error-message">{t(locationMessage(locationStatus))}</p>}
    {syncError && <p role="alert" className="error-message">{t(syncError)}</p>}
    {location && <>
      <p className="location-detail">{t("Location captured at ")}{new Date(location.capturedAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })}.{location.accuracy !== null && t(' GPS accuracy: approximately {metres} metres.', { metres: Math.round(location.accuracy) })}</p>
      {hospitalStatus === 'unavailable' && <p role="status" className="error-message">{t("The hospital search services did not respond. Your location and map are still available. Retry the search or open Google Maps below.")}</p>}
      {hospitalStatus === 'empty' && <p role="status" className="feature-notice">{t("No hospitals were returned within 5 km. This does not mean there are no hospitals nearby. Call 112 in an emergency.")}</p>}
      {['unavailable', 'empty'].includes(hospitalStatus) && <p><a className="secondary-button directions-link" href={hospitalSearchUrl(location)} target="_blank" rel="noopener noreferrer">{t("Search hospitals in Google Maps ↗")}</a></p>}
      <Suspense fallback={<p role="status">{t("Loading map…")}</p>}><HospitalMap location={location} hospitals={hospitals} /></Suspense>
    </>}
    {hospitals.length > 0 && <section aria-labelledby="hospital-list-heading" className="hospital-results">
      <h2 id="hospital-list-heading">{t("Nearest listed hospitals")}</h2><p role="status">{hospitals.length}{t(" hospitals found, sorted by distance.")}</p>
      {hospitals.some((hospital) => hospital.source === 'photon') && <p className="feature-notice">{t("Showing backup results from Photon / OpenStreetMap, limited to 50 listings. This list may not include every nearby hospital.")}</p>}
      <ol className="hospital-list">{hospitals.map((hospital, index) => <li className="hospital-card" key={hospital.id}>
        <div className="hospital-heading"><span className="hospital-number" aria-hidden="true">{index + 1}</span><h3>{hospital.name}</h3></div>
        <p>{hospital.distanceKm.toFixed(2)}{t(" km away · straight-line distance")}{index === 0 && t(" · Nearest listed")}</p>
        <a className="secondary-button directions-link" href={directionsUrl(hospital)} target="_blank" rel="noopener noreferrer" aria-label={t('Directions to {name} in Google Maps, opens a new tab', { name: hospital.name })}>{t("Directions ↗")}</a>
      </li>)}</ol>
    </section>}
  </section>;
}
