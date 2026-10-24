import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Link } from 'react-router-dom';
import { useAppointments } from '../context/AppointmentContext';
import { appointmentLabel, appointmentTime } from '../lib/appointments';

export default function AppointmentReminders() {
  useLanguage();
  const state = useAppointments();
  if (!state) return null;
  return <aside className="reminder-region" aria-label={t("Appointment reminders")}>
    {state.error && <p className="error-message" role="alert">{t(state.error)}</p>}
    {state.notice && <p className="success-message" role="status">{t(state.notice)}</p>}
    {state.due.length > 0 && <div className="dose-banner"><h2 role="alert">{t("Appointment reminder")}</h2>
      {state.cached && <p role="status">{t("Showing cached reminders. Reconnect to confirm the latest schedule.")}</p>}
      {state.due.map((reminder) => <div className="due-dose" key={reminder.id}><p><strong>{appointmentLabel(reminder.appointment)}</strong><br />{t(reminder.label)}<br />{appointmentTime(reminder.appointment)}</p>
        <button className="button" disabled={Boolean(state.busy)} onClick={() => state.act(reminder.appointment.id, 'acknowledge', reminder)} aria-label={t('Dismiss {reminder} for {name}', { reminder: t(reminder.label), name: appointmentLabel(reminder.appointment) })}>{t("Dismiss reminder")}</button>
      </div>)}<p>{t("Dismissal acknowledges this reminder; it does not mark the visit as completed.")}</p><Link className="back-link" to="/patient/appointments">{t("View appointments →")}</Link>
    </div>}
  </aside>;
}
