import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Link } from 'react-router-dom';
import { useEmergency } from '../context/EmergencyContext';
import { useScreenSpeech } from '../context/SpeechContext';

export default function SosPage() {
  useLanguage();
  const { start, state, nearby } = useEmergency();
  const active = !['idle', 'cancelled'].includes(state.phase);
  useScreenSpeech('SOS', 'SOS. For an emergency, call 112. The SOS button starts a ten-second countdown. Select Cancel if you are okay. Otherwise an alert is saved with your name, current medicines, and available GPS and nearest hospital details. Simulate fall uses the same countdown. Real fall detection is not available. Keep CareLink open.');
  return <section className="care-page sos-page">
    <Link className="back-link" to="/patient">{t("← Back to home")}</Link>
    <p className="eyebrow">{t("REACH FOR HELP")}</p><h1>{t("SOS")}</h1>
    <p className="page-intro">{t("In an emergency, call 112 directly.")}</p>
    <a className="emergency-button" href="tel:112">{t("Call 112 ")}<span>{t("Emergency assistance")}</span></a>
    <button className="sos-start" disabled={active} onClick={() => start('sos')} aria-label={t("Start SOS: ten seconds to cancel")}><strong>{t("SOS")}</strong><span>{t("Start 10-second countdown")}</span></button>
    <div className="feature-notice"><h2>{t("Let your family know")}</h2><p>{t("SOS starts a 10-second “Are you okay?” countdown. Cancel if you are okay. Otherwise CareLink saves an alert containing your name, current medicines, and available GPS and nearest hospital details.")}</p>
      <p>{t("Location is requested when you start; a lookup from the last 30 seconds may be reused. Hospital lookup shares coordinates with the map service. Denied GPS or a failed lookup will be marked unavailable in the alert.")}</p>
      <p>{t("Keep CareLink open and connected. Linked family can see saved alerts in their live dashboard. CareLink does not dispatch help or call emergency services.")}</p>
    </div>
    <div className="simulation-card"><h2>{t("Try a simulated fall")}</h2><p>{t("This is a manual demo. Real fall detection is a future feature.")}</p><button className="secondary-button" disabled={active} onClick={() => start('fall')}>{t("Simulate fall")}</button></div>
    {nearby.hospitals[0] && <p className="feature-notice">{t("Nearest listed hospital from the latest lookup: ")}<strong>{nearby.hospitals[0].name}</strong>. {nearby.hospitals[0].distanceKm.toFixed(2)}{t(" km away.")}</p>}
    <Link className="back-link" to="/patient/help">{t("View nearby hospitals and directions →")}</Link>
  </section>;
}
