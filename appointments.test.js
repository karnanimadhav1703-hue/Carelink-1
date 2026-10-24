import { expect, it } from 'vitest';
import { appointmentReminders, localDateTime, parseAppointmentTime, validateAppointment } from './appointments';
const time = new Date(2027, 0, 15, 10, 30).getTime();
const visit = { id: 'a1', revision: 1, doctor: 'Example clinic', scheduledAt: time, reminderMinutes: 60, status: 'scheduled', acknowledged: {} };
it('parses local calendar input and rejects invalid or past dates', () => {
  expect(parseAppointmentTime('2027-01-15T10:30')).toBe(time);
  expect(localDateTime(time)).toBe('2027-01-15T10:30');
  expect(() => parseAppointmentTime('2027-02-30T10:30')).toThrow();
  expect(() => validateAppointment({ scheduledTime: time, reminderMinutes: 60 }, time)).toThrow('future');
  expect(() => validateAppointment({ scheduledTime: time, reminderMinutes: 90 }, time - 1)).toThrow('list');
  expect(validateAppointment({ doctor: '  Clinic  ', scheduledTime: time, reminderMinutes: 15 }, time - 1).doctor).toBe('Clinic');
});
it('shows one advance reminder, then the visit-time reminder, and stops after one day', () => {
  expect(appointmentReminders([visit], time - 3600001)).toEqual([]);
  expect(appointmentReminders([visit], time - 3600000).map((item) => item.kind)).toEqual(['advance']);
  expect(appointmentReminders([visit], time).map((item) => item.kind)).toEqual(['due']);
  expect(appointmentReminders([visit], time + 86400000)).toEqual([]);
});
it('acknowledgement does not complete a visit, and cancellation/completion suppress all reminders', () => {
  const acknowledged = { ...visit, acknowledged: { advance: true } };
  expect(appointmentReminders([acknowledged], time - 1)).toEqual([]);
  expect(appointmentReminders([acknowledged], time)).toHaveLength(1);
  for (const status of ['cancelled', 'completed']) expect(appointmentReminders([{ ...visit, status, demoAt: time }], time)).toEqual([]);
});
it('gives edited schedules and separate demo reminders distinct IDs', () => {
  const original = appointmentReminders([visit], time)[0];
  expect(appointmentReminders([{ ...visit, revision: 2 }], time)[0].id).not.toBe(original.id);
  const demo = appointmentReminders([{ ...visit, reminderMinutes: 0, demoAt: time - 60000 }], time - 60000);
  expect(demo[0].kind).toBe(`demo_${time - 60000}`);
});
