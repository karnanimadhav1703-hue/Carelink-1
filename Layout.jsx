import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authMessage } from '../lib/authErrors';
import { useMode } from '../context/ModeContext';
import { useSpeech } from '../context/SpeechContext';
import { needsModeSelection } from '../lib/modes';
import SpeechControls from './SpeechControls';
import DoseReminders from './DoseReminders';
import EmergencyBanner from './EmergencyBanner';
import InstallControls from './InstallControls';
import AppointmentReminders from './AppointmentReminders';
import LanguageSelector from './LanguageSelector';

export default function Layout() {
  useLanguage();
  const { user, profile, logout } = useAuth();
  const { mode } = useMode();
  const { stop } = useSpeech();
  const { pathname } = useLocation();
  const main = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => { if (!user) stop(); }, [user, stop]);

  async function handleLogout() {
    setBusy(true);
    setError('');
    try { await logout(); } catch (err) { setError(authMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <div className="app-shell" data-mode={mode}>
      <a className="skip-link" href="#main">{t("Skip to main content")}</a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label={t("CareLink home")}><img className="brand-mark" src="/icons/icon-192.png" alt="" width="35" height="35" />CareLink<span className="brand-dot">.</span></Link>
        {user ? <nav className="header-actions" aria-label={t("Account")}>
          {profile?.role === 'patient' && !needsModeSelection(profile) && <Link className="text-button" to="/settings">{t("Settings")}</Link>}
          <button className="text-button" onClick={handleLogout} disabled={busy}>{busy ? t("Signing out…") : t("Sign out")}</button>
        </nav> : null}
      </header>
      <LanguageSelector />
      {error && <p className="error-message mx-auto" role="alert">{t(error)}</p>}
      <main id="main" ref={main} tabIndex={-1}><EmergencyBanner /><DoseReminders /><AppointmentReminders /><Outlet /><SpeechControls /></main>
      <footer className="site-footer">
        <InstallControls />
        <p>{t("CareLink does not diagnose conditions or provide medical advice.")}</p>
        <a href="tel:112" className="emergency-link" aria-label={t("Emergency: Call 112")}><span aria-hidden="true">↗</span>{t(" Call 112 ")}<span className="font-normal">{t("· Emergency")}</span></a>
      </footer>
    </div>
  );
}
