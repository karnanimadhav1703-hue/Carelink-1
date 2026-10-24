import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useScreenSpeech } from '../context/SpeechContext';
import { familyError, familyServices, formatInvite } from '../lib/familyDatabase';
import { millis } from '../lib/doses';
import { dateTime } from '../lib/familyView';

export default function FamilyConnectionsPage({ services = familyServices }) {
  useLanguage();
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [ready, setReady] = useState(false);
  const [cached, setCached] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now);
  useScreenSpeech('Family connections', 'Family connections. Create an invite code and share it with a trusted family member. They enter it in their family account. Each code expires after 24 hours and can be used once. Connected family can view your medicine history, alerts, and shared location. For an emergency, call 112.');
  useEffect(() => {
    let active = true;
    const stop = services.watchPatientConnections(user.uid, (snapshot) => {
      if (active) { setRecords(snapshot.records); setReady(true); setCached(snapshot.fromCache); }
    }, (err) => { if (active) setError(familyError(err)); });
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { active = false; stop(); clearInterval(timer); };
  }, [user.uid, services]);
  const invite = records.find((record) => record.kind === 'invite' && record.state === 'open' && millis(record.expiresAt) > now);
  const links = records.filter((record) => record.kind === 'link');
  async function create() {
    setBusy(true); setError(''); setMessage('');
    try {
      await services.createInvite(user.uid, Boolean(invite));
      setMessage('Invite code saved. Share it only with the family member you want to connect.');
      setNow(Date.now());
    } catch (err) { setError(familyError(err)); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(formatInvite(invite.inviteCode)); setMessage('Invite code copied.'); }
    catch { setMessage('Copy is unavailable. Select the code and copy it manually.'); }
  }
  return <section className="care-page connection-page">
    <Link className="back-link" to="/settings">{t("← Back to settings")}</Link>
    <p className="eyebrow">{t("YOUR PEOPLE, CONNECTED")}</p><h1>{t("Family connections")}</h1>
    <p className="page-intro">{t("Invite someone you trust to follow your care.")}</p>
    <div className="family-card"><h2>{t("Share an invite")}</h2><p>{t("A connected family account can view your medicines, dose history, alerts, and location shared through Help Near Me or SOS.")}</p>
      <p>{t("Each code is valid for 24 hours and can be used by one family account. Create another code to invite another person. A new code replaces your unused code; it does not remove existing connections.")}</p>
      {!ready && <p role="status">{t("Loading connections…")}</p>}
      {ready && cached && <p role="status">{t("Showing cached connections. Connect to the internet before sharing a code.")}</p>}
      {invite && <div className="invite-panel"><p>{t("Your invite code")}</p><output className="invite-code" aria-label={t("Your invite code")}>{formatInvite(invite.inviteCode)}</output><p>{t("Expires ")}{dateTime(invite.expiresAt)}</p><button className="secondary-button" onClick={copy} disabled={cached}>{t("Copy code")}</button></div>}
      <button className="button" disabled={busy || !ready} onClick={create}>{busy ? t("Creating…") : invite ? t("Get a new code") : t("Create invite code")}</button>
      {error && <p className="error-message" role="alert">{t(error)}</p>}
      {message && <p className="success-message" role="status">{t(message)}</p>}
    </div>
    <div className="family-card"><h2>{t("Connected family")}</h2>{ready && !links.length && <p>{t("No family accounts linked yet. Share your code to get started.")}</p>}
      <ul className="connection-list">{links.map((link) => <li key={link.id}><strong>{link.familyName || t("Family member")}</strong><span>{t("Connected ")}{dateTime(link.createdAt)}</span></li>)}</ul>
    </div>
  </section>;
}
