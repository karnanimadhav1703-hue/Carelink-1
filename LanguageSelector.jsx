import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelector() {
  const { language, chooseLanguage, busy, message, t } = useLanguage();
  return <div className="language-control">
    <label htmlFor="app-language">Language / भाषा</label>
    <select id="app-language" value={language} disabled={busy} onChange={(event) => void chooseLanguage(event.target.value)}>
      <option value="en" lang="en">English</option><option value="hi" lang="hi">हिन्दी</option>
    </select>
    {busy && <span role="status">{t('Saving…')}</span>}
    {message && <span className="language-message" role="status">{t(message)}</span>}
  </div>;
}
