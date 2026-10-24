import { t, getLocale } from './i18n';
import { millis } from './doses';

export const REMINDER_OPTIONS = [
  { minutes: 1440, label: '1 day before' }, { minutes: 60, label: '1 hour before' },
  { minutes: 15, label: '15 minutes before' }, { minutes: 0, label: 'At the appointment time only' },
];
export function localDateTime(value) {
  const date = new Date(millis(value));
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function parseAppointmentTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid visit date and time.');
  const time = new Date(value).getTime();
  // Reject impossible dates and local times skipped by a daylight-saving change.
  if (!Number.isFinite(time) || localDateTime(time) !== value) throw new Error('Choose a valid visit date and time.');
  return time;
}
export function validateAppointment(fields, now = Date.now()) {
  const doctor = String(fields.doctor || '').trim();
  const scheduledTime = Number(fields.scheduledTime);
  const reminderMinutes = Number(fields.reminderMinutes);
  if (doctor.length > 120) throw new Error('Keep the doctor or clinic name within 120 characters.');
  if (!Number.isFinite(scheduledTime) || scheduledTime <= now) throw new Error('Choose a future visit date and time.');
  if (!REMINDER_OPTIONS.some((option) => option.minutes === reminderMinutes)) throw new Error('Choose a reminder time from the list.');
  return { doctor, scheduledTime, reminderMinutes };
}
export function appointmentLabel(appointment) { return appointment.doctor || t('Doctor visit'); }
export function appointmentTime(appointment) {
  return new Date(millis(appointment.scheduledAt)).toLocaleString(getLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}
export function appointmentReminders(appointments, now) {
  return appointments.flatMap((appointment) => {
    if (appointment.status !== 'scheduled') return [];
    const time = millis(appointment.scheduledAt);
    if (!time) return [];
    const events = [];
    const add = (kind, label) => {
      if (!appointment.acknowledged?.[kind]) events.push({ id: `${appointment.id}:${appointment.revision}:${kind}`, kind, appointment, label });
    };
    if (appointment.reminderMinutes > 0 && now >= time - appointment.reminderMinutes * 60000 && now < time) add('advance', 'Upcoming appointment');
    // Catch up on reopening for one day, without announcing older visits forever.
    if (now >= time && now < time + 86400000) add('due', 'Appointment time reached');
    const demo = millis(appointment.demoAt);
    if (demo && now >= demo && now < demo + 3600000) add(`demo_${demo}`, 'Demo appointment reminder');
    return events;
  });
}
