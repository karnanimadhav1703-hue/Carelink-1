import { appointmentLabel, appointmentTime } from './appointments';
import { t, getLocale } from './i18n';

export async function enableNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'Browser notifications are unavailable here. In-app reminders still work.';
  if (Notification.permission === 'denied') return 'Notifications are blocked. You can allow them in browser site settings. In-app reminders still work.';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'Notifications were not enabled. In-app reminders still work.';
  await navigator.serviceWorker.register('/notifications-sw.js');
  return 'Browser notifications enabled. Keep CareLink open for reminders.';
}
export async function notifyAppointment(reminder) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  await navigator.serviceWorker.register('/notifications-sw.js');
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(`CareLink · ${t(reminder.label)}`, {
    lang: getLocale(),
    body: t('{name} · {time}. Open CareLink for your visit details.', { name: appointmentLabel(reminder.appointment), time: appointmentTime(reminder.appointment) }),
    tag: `appointment:${reminder.id}`, data: { url: '/patient/appointments' },
  });
}
export async function notifyDose(occurrence) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  await navigator.serviceWorker.register('/notifications-sw.js');
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(t(occurrence.demo ? 'CareLink demo reminder' : 'CareLink medicine reminder'), {
    lang: getLocale(),
    body: t('{name} · {dose}. Open CareLink to log this dose.', { name: occurrence.medicine.name, dose: occurrence.medicine.dose }),
    tag: occurrence.id, data: { url: '/patient/medicines' },
  });
}
