import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMedicines } from '../context/MedicineContext';
import { useScreenSpeech } from '../context/SpeechContext';
import { addMedicine, scheduleDemo } from '../lib/medicineDatabase';
import { enableNotifications } from '../lib/notifications';
import { LOOKBACK_MS, millis, timeLabel, validateMedicine } from '../lib/doses';

export default function MedicinesPage({ saveMedicine = addMedicine, setDemo = scheduleDemo }) {
  useLanguage();
  const { user } = useAuth();
  const { medicines, logs, doses, logById, now, ready, busy: taking, take } = useMedicines();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState(['09:00']);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useScreenSpeech('Medicines', 'Medicines. Add a medicine name, dose, and daily times from your existing instructions. Keep CareLink open for reminders. A due reminder has a Taken button. Demo reminders do not mean you should take an extra dose. For an emergency, call 112.');
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    let fields;
    try { fields = validateMedicine({ name, dose, times }); } catch (err) { setError(err.message); return; }
    setBusy(true);
    try { await saveMedicine(user.uid, fields); setName(''); setDose(''); setTimes(['09:00']); setMessage('Medicine saved. Daily reminders start from the next scheduled time.'); }
    catch { setError('Medicine could not be saved. Check your connection and Firestore access, then try again.'); }
    finally { setBusy(false); }
  }
  async function demo(medicine) {
    setBusy(true); setError('');
    try { const time = await setDemo(user.uid, medicine.id); setMessage({ key: 'Demo for {name} set for {time}. This is practice; do not take an extra dose.', values: { name: medicine.name, time: timeLabel(time) } }); }
    catch { setError('Could not set the demo. Finish any pending demo for this medicine, check your connection, and try again.'); }
    finally { setBusy(false); }
  }
  const today = new Date(now).toDateString();
  const todayDoses = doses.filter((item) => new Date(item.scheduledTime).toDateString() === today);
  // Logs remain visible if a newer demo replaces its one-shot schedule.
  const extraLogs = logs.filter((log) => new Date(millis(log.scheduledTime)).toDateString() === today && !todayDoses.some((item) => item.id === log.id));
  return <section className="care-page medicine-page">
    <Link className="back-link" to="/patient">{t("← Back to home")}</Link>
    <p className="eyebrow">{t("YOUR DAILY ROUTINE")}</p><h1>{t("Medicines")}</h1>
    <p className="page-intro">{t("A little help remembering your routine.")}</p>
    <div className="feature-notice"><p>{t("Keep CareLink open and connected. Reminders may be delayed when your phone sleeps or the browser pauses. They are not guaranteed when the app is closed.")}</p>
      <p>{t("Times use this device’s timezone: ")}{Intl.DateTimeFormat().resolvedOptions().timeZone}{t(". A dose not logged within 15 minutes creates an alert in linked family dashboards.")}</p>
      <button className="secondary-button" onClick={async () => { try { setMessage(await enableNotifications()); } catch { setMessage('Notifications could not be enabled. In-app reminders still work.'); } }}>{t("Enable browser notifications")}</button>
    </div>
    {message && <p className="success-message" role="status">{t(message)}</p>}
    {error && <p className="error-message" role="alert">{t(error)}</p>}
    <div className="medicine-grid">
      <form className="medicine-card medicine-form" onSubmit={submit}>
        <h2>{t("Add a medicine")}</h2><p>{t("Copy your existing instructions. CareLink does not recommend medicines or doses.")}</p>
        <label htmlFor="medicine-name">{t("Medicine name")}</label><input id="medicine-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder={t("e.g. Your medicine name")} />
        <label htmlFor="medicine-dose">{t("Dose")}</label><input id="medicine-dose" value={dose} onChange={(event) => setDose(event.target.value)} maxLength={80} required placeholder={t("e.g. 1 tablet")} />
        <fieldset><legend>{t("Daily times")}</legend>{times.map((time, index) => <div className="time-row" key={index}>
          <label htmlFor={`time-${index}`}>{t("Time ")}{index + 1}</label><input id={`time-${index}`} type="time" value={time} required onChange={(event) => setTimes(times.map((value, i) => i === index ? event.target.value : value))} />
          {times.length > 1 && <button type="button" className="secondary-button" aria-label={t('Remove time {number}', { number: index + 1 })} onClick={() => setTimes(times.filter((_, i) => i !== index))}>{t("Remove")}</button>}
        </div>)}</fieldset>
        <div className="medicine-actions"><button type="button" className="secondary-button" disabled={times.length >= 6 || busy} onClick={() => setTimes([...times, '18:00'])}>{t("Add another time")}</button><button className="button" disabled={busy}>{busy ? t("Saving…") : t("Save medicine")}</button></div>
      </form>
      <div><h2>{t("Your medicines")}</h2>{!ready ? <p role="status">{t("Loading medicines…")}</p> : !medicines.length ? <p>{t("No medicines yet. Add your first medicine to start.")}</p> : medicines.map((medicine) => <article className="medicine-card" key={medicine.id}>
        <h3>{medicine.name}</h3><p>{medicine.dose}</p><p>{t("Daily: ")}{medicine.times.join(' · ')}</p>
        {millis(medicine.demoAt) > now && <p>{t("Demo scheduled: ")}{timeLabel(medicine.demoAt)}</p>}
        <button className="secondary-button" disabled={busy || Boolean(millis(medicine.demoAt) >= now - LOOKBACK_MS && !logById.has(`${medicine.id}_${millis(medicine.demoAt)}`))} onClick={() => demo(medicine)}>{t("Remind me in 1 minute")}</button>
        <p className="medicine-small">{t("Demo only. Do not take an extra dose.")}</p>
      </article>)}</div>
    </div>
    <section className="today-list" aria-labelledby="today-heading"><h2 id="today-heading">{t("Today’s doses")}</h2>
      <p>{t("“Taken” records your confirmation. A late confirmation keeps the earlier missed alert in the family history.")}</p>
      {ready && !todayDoses.length && !extraLogs.length && <p>{t("No scheduled doses remaining for today.")}</p>}
      {todayDoses.map((item) => { const log = logById.get(item.id); return <article className="medicine-card" key={item.id}><h3>{item.medicine.name}{item.demo && t(" · Demo")}</h3><p>{timeLabel(item.scheduledTime)} · {log ? (log.status === 'taken' ? (log.wasMissed ? t("Taken late") : t("Taken")) : t("Missed — family alert saved")) : item.scheduledTime > now ? t("Upcoming") : t("Due")}</p>
        {log?.status === 'missed' && <button className="secondary-button" disabled={Boolean(taking)} onClick={() => take(item)} aria-label={t('Log taken late: {name}', { name: item.medicine.name })}>{t("Log taken late")}</button>}
      </article>; })}
      {extraLogs.map((log) => <article className="medicine-card" key={log.id}><h3>{log.medicineName}{log.demo && t(" · Demo")}</h3><p>{timeLabel(log.scheduledTime)} · {log.status === 'taken' ? (log.wasMissed ? t("Taken late") : t("Taken")) : t("Missed — family alert saved")}</p></article>)}
    </section>
  </section>;
}
