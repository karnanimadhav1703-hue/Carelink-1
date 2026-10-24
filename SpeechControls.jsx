import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useMode } from '../context/ModeContext';
import { useSpeech } from '../context/SpeechContext';
export default function SpeechControls() {
  const { language } = useLanguage();
  const { mode } = useMode();
  const { text, status, supported, speak, stop } = useSpeech();
  if (mode !== 'vision-assist' || !text) return null;
  return <aside className="speech-panel" aria-label={t("Screen reading controls")}>
    <div className="speech-actions">
      <button className="button" onClick={() => speak(text)} disabled={!supported}>{t("Read this screen")}</button>
      <button className="secondary-button" onClick={stop}>{t("Stop reading")}</button>
    </div>
    <p className="speech-note" role="status">{!supported || status === 'unavailable'
      ? t(language === 'hi' ? 'Audio is unavailable for this language on your device. The screen summary is written below.' : 'Audio is unavailable in this browser. The screen summary is written below.')
      : status === 'speaking' ? t("Reading aloud.") : t("If you do not hear audio, select Read this screen.")}</p>
    <p className="screen-summary">{text}</p>
  </aside>;
}
