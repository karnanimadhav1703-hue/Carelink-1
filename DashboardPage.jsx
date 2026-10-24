import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import { useScreenSpeech } from '../context/SpeechContext';
import { modeName } from '../lib/modes';
import { FEATURES } from './FeaturePage';
import CareIcon from '../components/CareIcon';

export default function DashboardPage() {
  useLanguage();
  const { profile } = useAuth();
  const { mode } = useMode();
  const family = profile.role === 'family';
  useScreenSpeech(family ? 'Family home' : 'Home', family
    ? t('Hello {name}. Open the family live view to connect to a patient and follow their care. For an emergency, call 112.', { name: profile.name })
    : t('Hello {name}. CareLink home. Choose Medicines to add your schedule and log doses. Appointments lets you save doctor visits and set reminders. Help Near Me finds hospitals. SOS opens the alert page with a ten-second cancellation countdown. Settings lets you change your mode. For an emergency, call 112.', { name: profile.name }));
  return <section className={`care-page home-page ${family ? 'family-home' : 'patient-home'}`}>
    <div className="home-heading">
      <div><p className="eyebrow">{family ? t("FAMILY CARE SPACE") : t("YOUR EVERYDAY CARE")}</p><h1>{t("Hello, ")}{profile.name}.</h1></div>
      {!family && <span className="mode-badge">{t(modeName(mode))}{t(" mode")}</span>}
    </div>
    <p className="page-intro home-intro">{family ? t("A little closer to the people you care about.") : t("A little support for whatever today brings.")}</p>
    {family ? <div className="dashboard-card">
      <h2>{t("Your family care space")}</h2><Link className="button" to="/family">{t("Open family live view")}</Link>
    </div> : <>
      <p className="stage-notice">{t("Keep CareLink open for reminders and alerts. In an emergency, call 112.")}</p>
      <div className="care-actions" aria-label={t("Care options")}>{FEATURES.map((item) => <Link className={`care-action care-action-${item.id}`} to={`/patient/${item.id}`} key={item.id} aria-label={`${t(item.title)}. ${t(item.description)}`}>
        <span className="care-icon"><CareIcon name={item.icon} /></span>
        <span className="action-copy"><strong>{t(item.title)}</strong><span className="action-description">{t(item.description)}</span></span>
        <span className="action-arrow" aria-hidden="true">↗</span>
      </Link>)}</div>
    </>}
  </section>;
}
