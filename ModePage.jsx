import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useScreenSpeech } from '../context/SpeechContext';
import { needsModeSelection } from '../lib/modes';
import ModeForm from '../components/ModeForm';
export default function ModePage({ saveMode }) {
  useLanguage();
  const { profile } = useAuth();
  useScreenSpeech('Choose your mode', 'Welcome to CareLink. Choose Standard, Elderly, or Vision assist, then select Save and continue. You can change this later in Settings. For an emergency, call 112.');
  if (!needsModeSelection(profile)) return <Navigate to="/patient" replace />;
  return <section className="care-page mode-page">
    <p className="eyebrow">{t("A LITTLE MORE YOU")}</p><h1>{t("Care, at your pace.")}</h1>
    <p className="page-intro">{t("One app. Choose the way that feels right for you.")}</p>
    <ModeForm onboarding saveMode={saveMode} />
  </section>;
}
