import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useEffect, useState } from 'react';

export default function InstallControls() {
  useLanguage();
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
  const [message, setMessage] = useState('');
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const offered = (event) => { event.preventDefault(); setPrompt(event); };
    const done = () => { setInstalled(true); setPrompt(null); setMessage(''); };
    const network = () => setOffline(!navigator.onLine);
    window.addEventListener('beforeinstallprompt', offered);
    window.addEventListener('appinstalled', done);
    window.addEventListener('online', network); window.addEventListener('offline', network);
    return () => {
      window.removeEventListener('beforeinstallprompt', offered); window.removeEventListener('appinstalled', done);
      window.removeEventListener('online', network); window.removeEventListener('offline', network);
    };
  }, []);
  async function install() {
    const offer = prompt; setPrompt(null);
    try {
      await offer.prompt();
      const result = await offer.userChoice;
      setMessage(result.outcome === 'accepted' ? 'Installation requested. Follow your browser’s instructions.' : 'You can install later from your browser menu.');
    } catch { setMessage('Use your browser menu to install CareLink or add it to your home screen.'); }
  }
  return <div className="install-controls">
    {offline && <p role="status" className="offline-notice">{t("You’re offline. Live updates and saves need an internet connection.")}</p>}
    {installed ? <p>{t("CareLink is installed on this device.")}</p> : <>
      {prompt && <button className="secondary-button" onClick={install}>{t("Install CareLink")}</button>}
      <details><summary>{t("Install CareLink on your device")}</summary><p>{t("In Chrome or Edge, open the browser menu and choose Install app or Add to home screen. On iPhone or iPad, open CareLink in Safari, tap Share, then Add to Home Screen. Options depend on your browser.")}</p></details>
    </>}
    {message && <p role="status">{t(message)}</p>}
    <p>{t("Keep CareLink open for reminders and alerts. Internet is required for live care updates.")}</p>
  </div>;
}
