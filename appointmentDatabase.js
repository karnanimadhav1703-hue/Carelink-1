import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { appointmentReminders, validateAppointment } from './appointments';
import { millis } from './doses';

function owner(patientId) {
  if (!db || auth?.currentUser?.uid !== patientId) throw new Error('Sign in to your patient account first.');
}
export function watchAppointments(patientId, onChange, onError) {
  return onSnapshot(query(collection(db, 'appointments'), where('patientId', '==', patientId)), { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.metadata.hasPendingWrites) onChange({ records: snapshot.docs.map((item) => ({ ...item.data(), id: item.id })), fromCache: snapshot.metadata.fromCache });
  }, onError);
}
export async function saveAppointment(patientId, fields, existingId = null) {
  owner(patientId);
  const values = validateAppointment(fields);
  const ref = existingId ? doc(db, 'appointments', existingId) : doc(collection(db, 'appointments'));
  await runTransaction(db, async (tx) => {
    const old = (await tx.get(ref)).data();
    if (existingId && (old?.patientId !== patientId || old.status !== 'scheduled')) throw new Error('This appointment is no longer available to edit.');
    validateAppointment(values); // Recheck if Firestore retries after a delay.
    tx.set(ref, { patientId, doctor: values.doctor, scheduledAt: Timestamp.fromMillis(values.scheduledTime),
      reminderMinutes: values.reminderMinutes, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      status: 'scheduled', revision: (old?.revision || 0) + 1, acknowledged: {}, demoAt: null,
      createdAt: old?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return ref.id;
}
export async function updateAppointment(patientId, appointmentId, action, reminder = null) {
  owner(patientId);
  if (!['complete', 'cancel', 'demo', 'acknowledge'].includes(action)) throw new Error('Unknown appointment action.');
  const ref = doc(db, 'appointments', appointmentId);
  return runTransaction(db, async (tx) => {
    const appointment = (await tx.get(ref)).data();
    if (appointment?.patientId !== patientId) throw new Error('Appointment not found.');
    if (appointment.status !== 'scheduled') return false;
    const now = Date.now();
    let update;
    if (action === 'complete' || action === 'cancel') update = { status: action === 'complete' ? 'completed' : 'cancelled' };
    if (action === 'demo') {
      if (millis(appointment.scheduledAt) <= now) throw new Error('Use an upcoming appointment for a demo.');
      const previous = millis(appointment.demoAt);
      if (previous && now < previous + 3600000 && !appointment.acknowledged?.[`demo_${previous}`]) throw new Error('A demo is already pending. Dismiss it before starting another.');
      update = { demoAt: Timestamp.fromMillis(now + 60000) };
    }
    if (action === 'acknowledge') {
      if (!appointmentReminders([{ ...appointment, id: appointmentId }], now).some((item) => item.id === reminder?.id && item.kind === reminder?.kind)) return false;
      update = { acknowledged: { ...appointment.acknowledged, [reminder.kind]: true } };
    }
    tx.update(ref, { ...update, updatedAt: serverTimestamp() });
    return true;
  });
}
export const appointmentServices = { watchAppointments, saveAppointment, updateAppointment };
