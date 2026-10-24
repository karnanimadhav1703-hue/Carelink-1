import { collection, doc, onSnapshot, query, runTransaction, updateDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { isMode } from './modes';
import { getLanguage, isLanguage } from './i18n';

export const COLLECTIONS = Object.freeze({
  users: 'users', medicines: 'medicines', doseLogs: 'doseLogs', alerts: 'alerts', links: 'links',
});
function requireDatabase() {
  if (!db) throw new Error('Firebase is not configured.');
  return db;
}
function requireId(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) throw new Error('A valid document ID is required.');
  return value;
}
function ownProfileRef(uid) {
  if (auth?.currentUser?.uid !== uid) throw new Error('You can only update your own profile.');
  return doc(requireDatabase(), COLLECTIONS.users, requireId(uid));
}

// Prevent a delayed registration/recovery request overwriting an existing profile.
export async function createUserProfile(uid, { name, role }) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('Enter a name between 1 and 80 characters.');
  if (!['patient', 'family'].includes(role)) throw new Error('Choose a valid role.');
  const ref = ownProfileRef(uid);
  await runTransaction(requireDatabase(), async (transaction) => {
    const existing = await transaction.get(ref);
    if (!existing.exists()) transaction.set(ref, {
      name: name.trim(), role, mode: 'standard', modeSelected: role === 'family', language: getLanguage(),
    });
  });
}
export function watchUserProfile(uid, onChange, onError) {
  const ref = doc(requireDatabase(), COLLECTIONS.users, requireId(uid));
  return onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    // Do not navigate on a speculative local write that the server may reject.
    if (snapshot.metadata.hasPendingWrites) return;
    onChange(snapshot.exists() ? snapshot.data() : null);
  }, onError);
}
export async function savePatientMode(uid, mode) {
  if (!isMode(mode)) throw new Error('Choose Standard, Elderly, or Vision-assist.');
  // Only mode fields change; all other profile fields and records stay intact.
  await updateDoc(ownProfileRef(uid), { mode, modeSelected: true });
}

export async function saveUserLanguage(uid, language) {
  if (!isLanguage(language)) throw new Error('Choose English or Hindi.');
  await updateDoc(ownProfileRef(uid), { language });
}

// Read helpers for Stages 3–5. Always call the returned unsubscribe on cleanup.
// Filters are not authorization: production Firestore rules must enforce links.
export function watchPatientRecords(collectionName, patientId, onChange, onError) {
  if (![COLLECTIONS.medicines, COLLECTIONS.doseLogs, COLLECTIONS.alerts, COLLECTIONS.links].includes(collectionName)) {
    throw new Error('This collection does not contain patient records.');
  }
  const records = query(collection(requireDatabase(), collectionName), where('patientId', '==', requireId(patientId)));
  return onSnapshot(records, (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));
  }, onError);
}
export function watchFamilyLinks(familyUserId, onChange, onError) {
  const links = query(collection(requireDatabase(), COLLECTIONS.links), where('familyUserId', '==', requireId(familyUserId)));
  return onSnapshot(links, (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));
  }, onError);
}
