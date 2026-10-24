import { t, getLocale } from './i18n';
// Daily schedules use this device's local timezone. Store occurrences as timestamps.
export const MISSED_AFTER_MS = 15 * 60 * 1000;
export const LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const millis = (value) => value?.toMillis?.() ?? (typeof value === 'number' ? value : 0);
export const doseId = (medicineId, scheduledTime) => `${medicineId}_${scheduledTime}`;
export const timeLabel = (time) => new Date(millis(time)).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });

export function validateMedicine({ name, dose, times }) {
  if (!name?.trim() || name.trim().length > 80) throw new Error('Enter a medicine name, up to 80 characters.');
  if (!dose?.trim() || dose.trim().length > 80) throw new Error('Enter the dose from your existing instructions, up to 80 characters.');
  if (!Array.isArray(times) || !times.length || times.length > 6 || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('Choose between one and six valid daily times.');
  if (new Set(times).size !== times.length) throw new Error('Choose different times for each dose.');
  return { name: name.trim(), dose: dose.trim(), times: [...times].sort() };
}

export function occurrences(medicines, now) {
  const result = [];
  for (const medicine of medicines) {
    const created = millis(medicine.createdAt);
    if (!created) continue; // Wait for the server to confirm creation.
    const dates = [new Date(now), new Date(now)];
    dates[0].setDate(dates[0].getDate() - 1);
    for (const day of dates) for (const time of medicine.times) {
      const [hour, minute] = time.split(':').map(Number);
      const date = new Date(day);
      date.setHours(hour, minute, 0, 0);
      const scheduledTime = date.getTime();
      if (scheduledTime >= created && scheduledTime >= now - LOOKBACK_MS) result.push({ id: doseId(medicine.id, scheduledTime), medicine, scheduledTime, demo: false });
    }
    const demo = millis(medicine.demoAt);
    if (demo >= now - LOOKBACK_MS && demo > 0) result.push({ id: doseId(medicine.id, demo), medicine, scheduledTime: demo, demo: true });
  }
  return result.sort((a, b) => a.scheduledTime - b.scheduledTime);
}

export function validOccurrence(medicine, scheduledTime) {
  if (!Number.isSafeInteger(scheduledTime) || scheduledTime < millis(medicine.createdAt)) return false;
  if (scheduledTime === millis(medicine.demoAt)) return true;
  const date = new Date(scheduledTime);
  const localTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return date.getSeconds() === 0 && date.getMilliseconds() === 0 && medicine.times.includes(localTime);
}
