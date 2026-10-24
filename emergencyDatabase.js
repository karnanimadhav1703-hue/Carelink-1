import { collection, doc, getDocsFromServer, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { nearbySnapshot, validLocation } from './nearby';

function checkOwner(patientId) {
  if (!db || auth?.currentUser?.uid !== patientId) throw new Error('Sign in to your patient account first.');
}
export async function saveNearbySummary(patientId, result) {
  checkOwner(patientId);
  // Family listeners in Stage 5 can read the most recently requested nearby result.
  await updateDoc(doc(db, 'users', patientId), { nearby: { ...nearbySnapshot(result), updatedAt: serverTimestamp() } });
}
export async function saveEmergencyAlert(patientId, event, result) {
  checkOwner(patientId);
  if (!['sos', 'fall'].includes(event.type) || !/^[\w-]{1,150}$/.test(event.id)) throw new Error('Invalid emergency event.');
  if (result.location && !validLocation(result.location)) throw new Error('Invalid location.');
  // Fetch the medicine list at send time, rather than trusting an old UI snapshot.
  const medicines = await getDocsFromServer(query(collection(db, 'medicines'), where('patientId', '==', patientId)));
  const snapshot = medicines.docs.map((item) => {
    const medicine = item.data();
    return { medicineId: item.id, name: medicine.name, dose: medicine.dose, times: medicine.times };
  });
  const ref = doc(db, 'alerts', `${patientId}_${event.id}`);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return; // Retrying a failed/uncertain response must not duplicate an alert.
    tx.set(ref, { patientId, patientName: event.patientName, type: event.type,
      simulated: event.type === 'fall', ...nearbySnapshot(result), medicines: snapshot,
      createdAt: serverTimestamp() });
  });
  return ref.id;
}
