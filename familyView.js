import { t, getLocale } from './i18n';
import { millis } from './doses';

export const alertName = (alert) => t(({ sos: 'SOS', fall: 'Simulated fall', missedDose: 'Missed dose' })[alert.type] || 'Care alert');
export function dateTime(value) {
  const time = millis(value);
  return time ? new Date(time).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }) : t('Time unavailable');
}
export function todaysLogs(logs, now) {
  const today = new Date(now).toDateString();
  return logs.filter((log) => millis(log.scheduledTime) && new Date(millis(log.scheduledTime)).toDateString() === today)
    .sort((a, b) => millis(a.scheduledTime) - millis(b.scheduledTime));
}
export const newestAlerts = (alerts) => [...alerts].sort((a, b) => millis(b.createdAt) - millis(a.createdAt) || a.id.localeCompare(b.id));
// Baseline old alerts quietly; only newly received IDs should ring.
export function createAlertTracker() {
  let seen = null;
  return (alerts, serverConfirmed) => {
    if (!serverConfirmed) return [];
    if (!seen) { seen = new Set(alerts.map((alert) => alert.id)); return []; }
    const added = alerts.filter((alert) => !seen.has(alert.id));
    alerts.forEach((alert) => seen.add(alert.id));
    return added;
  };
}
