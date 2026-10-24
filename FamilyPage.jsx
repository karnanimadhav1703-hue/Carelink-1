import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useScreenSpeech } from '../context/SpeechContext';
import { familyError, familyServices, normalizeInvite } from '../lib/familyDatabase';
import { alertName } from '../lib/familyView';
import { useAlertSound } from '../hooks/useAlertSound';
import LinkedPatientView from '../components/LinkedPatientView';

export default function FamilyPage({ services = familyServices }) {
  useLanguage();
  const { user, profile } = useAuth();
  const [links, setLinks] = useState([]);
  const [ready, setReady] = useState(false);
  const [cached, setCached] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newAlerts, setNewAlerts] = useState([]);
  const sound = useAlertSound();
  const onNewAlerts = useCallback(({ patientId, patientName, alerts }) => {
    setNewAlerts((old) => [...old, ...alerts.map((alert) => ({ ...alert, patientId, patientName }))].slice(-20));
    sound.play();
  }, [sound.play]);
  useScreenSpeech('Family live view', t("Hello {name}. Family live view. Enter a patient's invite code to connect. Enable alert sound for new alerts while this dashboard is open. For an emergency, call 112.", { name: profile.name }));
  useEffect(() => {
    let active = true;
    const stop = services.watchFamilyConnections(user.uid, (snapshot) => {
      if (!active) return;
      const current = snapshot.records.filter((record) => record.kind === 'link');
      setLinks(current); setCached(snapshot.fromCache); setReady(true);
      setNewAlerts((old) => old.filter((alert) => current.some((link) => link.patientId === alert.patientId)));
    }, (err) => { if (active) setError(familyError(err)); });
    return () => { active = false; stop(); };
  }, [user.uid, services]);
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    let normalized;
    try { normalized = normalizeInvite(code); } catch (err) { setError(familyError(err)); return; }
    setBusy(true);
    try { await services.redeemInvite(user.uid, normalized); setCode(''); setMessage('Connection saved. The patient’s live care view will appear below.'); }
    catch (err) { setError(familyError(err)); }
    finally { setBusy(false); }
  }
  return <section className="care-page family-page">
    <p className="eyebrow">{t("FAMILY CARE SPACE")}</p><h1>{t("Hello, ")}{profile.name}.</h1><p className="page-intro">{t("Stay close to the people you care about.")}</p>
    <a className="emergency-button" href="tel:112">{t("Call 112 ")}<span>{t("Emergency assistance")}</span></a>
    {newAlerts.length > 0 && <aside className="family-new-alert" aria-label={t("New family alerts")}><h2 role="alert">{newAlerts.length}{t(" new ")}{newAlerts.length === 1 ? t("alert") : t("alerts")}</h2>
      <ul>{newAlerts.slice(-5).reverse().map((alert) => <li key={`${alert.patientId}_${alert.id}`}><strong>{alert.patientName}: {alertName(alert)}</strong><a href={`#alerts-${alert.patientId}`}>{t("View alerts")}</a></li>)}</ul>
      <button className="secondary-button" onClick={() => setNewAlerts([])}>{t("Dismiss banner")}</button><p>{t("Dismiss only clears this banner, not the saved alert history.")}</p>
    </aside>}
    <div className="sound-panel"><button className="secondary-button" onClick={sound.enabled ? sound.mute : sound.enable}>{sound.enabled ? t("Mute alert sound") : t("Enable alert sound")}</button><p role="status">{t(sound.message)}</p><p className="family-note">{t("Push, SMS, and closed-app alerts are not available. Existing alert history loads quietly.")}</p></div>
    <form className="family-card link-form" onSubmit={submit}><h2>{t("Connect to a patient")}</h2><p>{t("Ask the patient to open Settings → Family connections and share an invite code.")}</p><label htmlFor="invite-code">{t("Patient invite code")}</label>
      <input id="invite-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABCD-EFGH" required />
      <button className="button" disabled={busy}>{busy ? t("Connecting…") : t("Connect patient")}</button>
      {error && <p className="error-message" role="alert">{t(error)}</p>}{message && <p className="success-message" role="status">{t(message)}</p>}
    </form>
    {!ready && !error && <p role="status">{t("Loading your connections…")}</p>}
    {ready && cached && <p role="status" className="feature-notice">{t("Connection list is cached. Waiting for the server; reconnect before relying on updates.")}</p>}
    {ready && !links.length && <div className="family-card"><h2>{t("Your care circle starts here")}</h2><p>{t("No patients linked yet. Enter their code above.")}</p></div>}
    {links.map((link) => <LinkedPatientView key={link.patientId} link={link} onNewAlerts={onNewAlerts} services={services} />)}
  </section>;
}
