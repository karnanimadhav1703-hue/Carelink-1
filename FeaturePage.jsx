import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Link, useParams } from 'react-router-dom';
import { useScreenSpeech } from '../context/SpeechContext';
export const FEATURES = [
  { id: 'medicines', title: 'Medicines', icon: 'medicine', description: 'Your daily medicines, in one place.', stage: 3 },
  { id: 'appointments', title: 'Appointments', icon: 'calendar', description: 'Doctor visits and reminders, in one place.' },
  { id: 'help', title: 'Help Near Me', icon: 'location', description: 'Find nearby hospitals and directions.', stage: 4 },
  { id: 'sos', title: 'SOS', icon: 'sos', description: 'Reach for help when you need it.', stage: 4 },
];
export default function FeaturePage() {
  useLanguage();
  const { feature } = useParams();
  const item = FEATURES.find((entry) => entry.id === feature);
  const summary = item ? t('{title}. This feature is not active yet. It will be added in Stage {stage}. No reminder or emergency alert has been created. For an emergency, call 112.', { title: t(item.title), stage: item.stage }) : 'Page not found. Use Back to home to return to CareLink.';
  useScreenSpeech(item?.title || 'Page not found', summary);
  return <section className="care-page">
    <Link className="back-link" to="/patient">{t("← Back to home")}</Link><h1>{t(item?.title || 'Page not found')}</h1>
    <div className="feature-notice"><h2>{item ? t('Coming in Stage {stage}', { stage: item.stage }) : t("This page does not exist")}</h2>
      <p>{item ? t("This feature is not active yet. No reminders or emergency alerts are sent from this page.") : t("Return home to choose an available page.")}</p>
    </div>
    <a className="emergency-button" href="tel:112">{t("Call 112 ")}<span>{t("Emergency assistance")}</span></a>
  </section>;
}
