import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import { useSpeech } from '../context/SpeechContext';
import { MODES } from '../lib/modes';
import { savePatientMode } from '../lib/database';
import { authMessage } from '../lib/authErrors';

export default function ModeForm({ onboarding = false, onSaved, saveMode = savePatientMode }) {
  useLanguage();
  const { user } = useAuth();
  const { savedMode, setPreviewMode } = useMode();
  const { supported, speak } = useSpeech();
  const [selection, setSelection] = useState(savedMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setSelection(savedMode); }, [savedMode, dirty]);
  useEffect(() => () => setPreviewMode(null), [setPreviewMode]);
  function select(value) {
    setSelection(value); setPreviewMode(value); setDirty(true); setSaved(false); setError('');
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setSaved(false); setError('');
    try {
      // Success waits for the server acknowledgement.
      await saveMode(user.uid, selection);
      setDirty(false);
      setPreviewMode(null);
      setSaved(true);
      onSaved?.();
    } catch (err) { setError(authMessage(err)); }
    finally { setBusy(false); }
  }
  return <form className="mode-form" onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy}>
      <legend>{t("Choose how CareLink looks and sounds")}</legend>
      <div className="mode-options">{MODES.map((option) => <label key={option.id} className="mode-option">
        <input type="radio" name="mode" value={option.id} checked={selection === option.id} onChange={() => select(option.id)} aria-describedby={`mode-${option.id}-description`} />
        <span><strong>{t(option.name)}</strong><span id={`mode-${option.id}-description`} className="mode-description">{t(option.description)}</span></span>
        <span className="mode-number" aria-hidden="true">{option.symbol}</span>
      </label>)}</div>
    </fieldset>
    <p className="mode-hint">{dirty && !saved ? t("Preview only. Save your choice to keep it.") : t("You can change your mode any time in Settings.")}</p>
    {error && <p className="error-message" role="alert">{t(error)}{t(" Your choice has not been saved.")}</p>}
    {saved && <p className="success-message" role="status">{t("Your mode is saved to your profile.")}</p>}
    {busy && <p role="status">{t("Saving to your profile… Keep this page open. If you are offline, saving will finish when you reconnect.")}</p>}
    <div className="mode-form-actions">
      <button className="button" type="submit" disabled={busy}>{busy ? t("Saving…") : onboarding ? t("Save and continue") : t("Save mode")}</button>
      <button className="secondary-button" type="button" disabled={!supported} onClick={() => speak('Choose a mode. Standard: familiar cards. Elderly: very large text and big home buttons. Vision assist: spoken screen summaries and high contrast. Select your choice, then Save.')}>{t("Read mode options")}</button>
    </div>
    {!supported && <p className="mode-hint">{t("Audio is unavailable in this browser. All mode descriptions are written above.")}</p>}
  </form>;
}
