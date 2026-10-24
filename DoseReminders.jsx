import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useMedicines } from '../context/MedicineContext';
import { timeLabel } from '../lib/doses';

export default function DoseReminders() {
  useLanguage();
  const state = useMedicines();
  if (!state) return null;
  const { due, error, notice, busy, take } = state;
  return <aside className="reminder-region" aria-label={t("Medicine reminders")}>
    {error && <p className="error-message" role="alert">{t(error)}</p>}
    {notice && <p className="success-message" role="status">{t(notice)}</p>}
    {due.length > 0 && <div className="dose-banner">
      <h2 role="alert">{due.length === 1 ? t("A dose is due") : t('{count} doses are due', { count: due.length })}</h2>
      {due.map((dose) => <div className="due-dose" key={dose.id}>
        <p><strong>{dose.medicine.name}</strong><br />{dose.medicine.dose} · {timeLabel(dose.scheduledTime)}{dose.demo && t(" · Demo")}</p>
        <button className="button" disabled={Boolean(busy)} onClick={() => take(dose)} aria-label={t('Taken: {name} at {time}', { name: dose.medicine.name, time: timeLabel(dose.scheduledTime) })}>{busy === dose.id ? t("Saving…") : t("Taken")}</button>
      </div>)}
      <p>{t("Log only what you have taken. Follow your existing medicine instructions.")}</p>
    </div>}
  </aside>;
}
