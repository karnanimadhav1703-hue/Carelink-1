import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Link } from 'react-router-dom';
import { useScreenSpeech } from '../context/SpeechContext';
import ModeForm from '../components/ModeForm';
export default function SettingsPage({ saveMode }) {
  useLanguage();
  useScreenSpeech('Settings', 'Settings. Choose Standard, Elderly, or Vision assist. Your choice is a preview until you select Save mode. Family connections lets you create a code to invite a family member. Use Back to home to return. For an emergency, call 112.');
  return <section className="care-page mode-page">
    <Link className="back-link" to="/patient">{t("← Back to home")}</Link>
    <p className="eyebrow">{t("MAKE YOURSELF COMFORTABLE")}</p><h1>{t("Your settings")}</h1>
    <p className="page-intro">{t("Change the view. Keep your care connected.")}</p>
    <ModeForm saveMode={saveMode} />
    <div className="feature-notice"><h2>{t("Your family")}</h2><p>{t("Invite a trusted family member to follow your medicines and alerts.")}</p><Link className="secondary-button directions-link" to="/patient/family">{t("Family connections")}</Link></div>
  </section>;
}
