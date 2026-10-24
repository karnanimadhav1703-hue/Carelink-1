import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppointments } from '../context/AppointmentContext';
import { useScreenSpeech } from '../context/SpeechContext';
import { appointmentLabel, appointmentTime, localDateTime, parseAppointmentTime, REMINDER_OPTIONS, validateAppointment } from '../lib/appointments';
import { millis } from '../lib/doses';
import { enableNotifications } from '../lib/notifications';

export default function AppointmentsPage() {
  useLanguage();
  const { appointments, ready, cached, now, busy, act, save } = useAppointments();
  const [doctor, setDoctor] = useState(''); const [date, setDate] = useState(''); const [time, setTime] = useState('09:00');
  const [minutes, setMinutes] = useState(60); const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const formHeading = useRef(null);
  useScreenSpeech('Appointments', 'Appointments. Enter your doctor visit date and time, and choose when to be reminded. Keep CareLink open. You can edit, cancel, or mark a visit completed. For an emergency, call 112.');
  function reset() { setDoctor(''); setDate(''); setTime('09:00'); setMinutes(60); setEditing(null); }
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    let fields;
    try { fields = validateAppointment({ doctor, scheduledTime: parseAppointmentTime(`${date}T${time}`), reminderMinutes: minutes }); }
    catch (err) { setError(err.message); return; }
    setSaving(true);
    try { await save(fields, editing); reset(); setMessage('Appointment saved. Keep CareLink open for reminders.'); }
    catch { setError('Appointment could not be saved. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  function edit(appointment) {
    const [day, clock] = localDateTime(appointment.scheduledAt).split('T');
    setDoctor(appointment.doctor); setDate(day); setTime(clock); setMinutes(appointment.reminderMinutes); setEditing(appointment.id); setMessage(''); setError('');
    formHeading.current?.focus(); formHeading.current?.scrollIntoView?.({ block: 'start' });
  }
  const scheduled = appointments.filter((appointment) => appointment.status === 'scheduled').sort((a, b) => millis(a.scheduledAt) - millis(b.scheduledAt));
  const history = appointments.filter((appointment) => appointment.status !== 'scheduled').sort((a, b) => millis(b.scheduledAt) - millis(a.scheduledAt));
  return <section className="care-page appointment-page">
    <Link className="back-link" to="/patient">{t("← Back to home")}</Link><p className="eyebrow">{t("YOUR NEXT VISIT")}</p><h1>{t("Appointments")}</h1>
    <p className="page-intro">{t("Remember your next doctor visit.")}</p>
    <div className="feature-notice"><p>{t("Keep CareLink open and connected for reminders. Notifications may be delayed when the device sleeps; installing the app does not enable closed-app reminders.")}</p>
      <p>{t("Enter the time in this device’s timezone: ")}<strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong>{t(". You’ll receive your chosen advance reminder and another at the visit time. If the advance reminder time has already passed, it appears after saving.")}</p>
      <button className="secondary-button" onClick={async () => { try { setMessage(await enableNotifications()); } catch { setMessage('Notifications could not be enabled. In-app reminders still work.'); } }}>{t("Enable browser notifications")}</button>
    </div>
    {error && <p role="alert" className="error-message">{t(error)}</p>}{message && <p role="status" className="success-message">{t(message)}</p>}
    <form className="medicine-card medicine-form appointment-form" onSubmit={submit}>
      <h2 ref={formHeading} tabIndex={-1}>{editing ? t("Edit appointment") : t("Add an appointment")}</h2>
      <label htmlFor="appointment-doctor">{t("Doctor or clinic (optional)")}</label><input id="appointment-doctor" maxLength={120} value={doctor} onChange={(event) => setDoctor(event.target.value)} placeholder={t("e.g. My clinic")} />
      <label htmlFor="appointment-date">{t("Visit date")}</label><input id="appointment-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
      <label htmlFor="appointment-time">{t("Visit time")}</label><input id="appointment-time" type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
      <label htmlFor="appointment-reminder">{t("Remind me")}</label><select id="appointment-reminder" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>{REMINDER_OPTIONS.map((option) => <option key={option.minutes} value={option.minutes}>{t(option.label)}</option>)}</select>
      <div className="medicine-actions"><button className="button" disabled={saving || Boolean(busy)}>{saving ? t("Saving…") : editing ? t("Save changes") : t("Save appointment")}</button>{editing && <button type="button" className="secondary-button" disabled={saving} onClick={reset}>{t("Stop editing")}</button>}</div>
    </form>
    <h2>{t("Your visits")}</h2>{!ready && <p role="status">{t("Loading appointments…")}</p>}{ready && cached && <p role="status">{t("Showing cached appointments. Connect to confirm the latest schedule.")}</p>}
    {ready && !scheduled.length && <p>{t("No scheduled appointments yet.")}</p>}
    {scheduled.map((appointment) => <article className="medicine-card" key={appointment.id}>
      <h3>{appointmentLabel(appointment)}</h3><p>{appointmentTime(appointment)}{millis(appointment.scheduledAt) <= now && t(" · Visit time has passed")}</p>
      <p>{t("Advance reminder: ")}{t(REMINDER_OPTIONS.find((option) => option.minutes === appointment.reminderMinutes)?.label || 'Not set')}</p>
      {millis(appointment.demoAt) > now && <p role="status">{t("Demo reminder scheduled in about one minute.")}</p>}
      <div className="medicine-actions"><button className="secondary-button" disabled={saving || Boolean(busy)} onClick={() => edit(appointment)}>{t("Edit")}</button><button className="secondary-button" disabled={saving || Boolean(busy)} onClick={() => act(appointment.id, 'complete')}>{t("Mark completed")}</button><button className="secondary-button" disabled={saving || Boolean(busy)} onClick={() => act(appointment.id, 'cancel')}>{t("Cancel appointment")}</button></div>
      {millis(appointment.scheduledAt) > now && <button className="secondary-button" disabled={saving || Boolean(busy)} onClick={() => act(appointment.id, 'demo')}>{t("Test reminder in 1 minute")}</button>}
      <p className="medicine-small">{t("This is a personal reminder. Cancelling here does not cancel a booking with your doctor.")}</p>
    </article>)}
    {history.length > 0 && <section><h2>{t("Previous appointments")}</h2>{history.map((appointment) => <article className="medicine-card" key={appointment.id}><h3>{appointmentLabel(appointment)}</h3><p>{appointmentTime(appointment)} · {appointment.status === 'completed' ? t("Completed") : t("Cancelled")}</p></article>)}</section>}
  </section>;
}
