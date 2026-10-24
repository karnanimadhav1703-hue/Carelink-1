import { collection, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { doseId, LOOKBACK_MS, millis, MISSED_AFTER_MS, validOccurrence, validateMedicine } from './doses';

function checkOwner(patientId) {
  if (!db || auth?.currentUser?.uid !== patientId) throw new Error('Sign in to your patient account first.');
}
export async function addMedicine(patientId, fields) {
  checkOwner(patientId);
  const medicine = validateMedicine(fields);
  const ref = doc(collection(db, 'medicines'));
  // Transactions fail offline, so a queued save cannot look like a confirmed schedule.
  await runTransaction(db, async (tx) => {
    tx.set(ref, { ...medicine, patientId, createdAt: serverTimestamp() });
  });
  return ref.id;
}
export async function scheduleDemo(patientId, medicineId) {
  checkOwner(patientId);
  const ref = doc(db, 'medicines', medicineId);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    const medicine = snapshot.data();
    if (medicine?.patientId !== patientId) throw new Error('Medicine not found.');
    const previous = millis(medicine.demoAt);
    if (previous && previous >= Date.now() - LOOKBACK_MS) {
      const log = await tx.get(doc(db, 'doseLogs', doseId(medicineId, previous)));
      if (!log.exists()) throw new Error('This medicine already has a demo reminder. Mark it taken or wait for it to be missed.');
    }
    const scheduledTime = Date.now() + 60000;
    tx.update(ref, { demoAt: Timestamp.fromMillis(scheduledTime) });
    return scheduledTime;
  });
}

// The deterministic ID and transaction make retries and competing tabs safe.
export async function recordDose(patientId, occurrence, status, patientName, medicines) {
  checkOwner(patientId);
  if (!['taken', 'missed'].includes(status)) throw new Error('Invalid dose status.');
  const { scheduledTime } = occurrence;
  const id = doseId(occurrence.medicine.id, scheduledTime);
  const ref = doc(db, 'doseLogs', id);
  return runTransaction(db, async (tx) => {
    const medicineSnapshot = await tx.get(doc(db, 'medicines', occurrence.medicine.id));
    const existing = await tx.get(ref);
    const medicine = medicineSnapshot.data();
    if (medicine?.patientId !== patientId || !validOccurrence(medicine, scheduledTime)) throw new Error('This scheduled dose is no longer available.');
    const now = Date.now();
    if (now < scheduledTime || (status === 'missed' && now < scheduledTime + MISSED_AFTER_MS)) throw new Error('This dose is not due yet.');
    const old = existing.data();
    if (old?.status === 'taken' || (old && status === 'missed')) return false;
    // A late Taken click can race the background checker; it must still save the missed alert.
    const newlyMissed = !old && now >= scheduledTime + MISSED_AFTER_MS;
    tx.set(ref, {
      medicineId: occurrence.medicine.id, patientId, scheduledTime: Timestamp.fromMillis(scheduledTime), status,
      time: serverTimestamp(), wasMissed: newlyMissed || old?.status === 'missed' || old?.wasMissed || false,
      medicineName: medicine.name, dose: medicine.dose, demo: scheduledTime === millis(medicine.demoAt),
    });
    if (status === 'missed' || newlyMissed) tx.set(doc(db, 'alerts', `missed_${id}`), {
      patientId, patientName, type: 'missedDose', doseLogId: id,
      location: null, nearestHospital: null,
      medicines: medicines.map(({ id: medicineId, name, dose, times }) => ({ medicineId, name, dose, times })),
      medicineId: occurrence.medicine.id, scheduledTime: Timestamp.fromMillis(scheduledTime),
      demo: scheduledTime === millis(medicine.demoAt), createdAt: serverTimestamp(),
    });
    return true;
  });
}
