import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { millis } from './doses';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_LIFETIME = 24 * 60 * 60 * 1000;
function fail(code) { throw Object.assign(new Error(code), { code }); }
function ownAccount(uid) { if (!db || auth?.currentUser?.uid !== uid) fail('family/sign-in'); }
export function normalizeInvite(value) {
  const code = String(value).toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) fail('family/invalid-code');
  return code;
}
export function generateInviteCode() {
  // 32 symbols means modulo 32 is unbiased for a random byte (40 bits total).
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => ALPHABET[byte % 32]).join('');
}
export const formatInvite = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;
export function familyError(error) {
  return ({
    'family/invalid-code': 'Enter the eight characters from the patient’s invite code.',
    'family/unavailable-code': 'This code has expired, was replaced, or was already used. Ask the patient for a new code.',
    'family/role': 'Use a patient account to create invites and a family account to accept them.',
    'family/sign-in': 'Please sign in again before linking accounts.',
    'family/patient-missing': 'This patient profile is unavailable. Ask the patient to check their account.',
    'permission-denied': 'CareLink could not access the connection. Check Firestore permissions and their expiry date.',
  })[error?.code] || 'Could not save the connection. Check your internet connection and try again.';
}

export async function createInvite(patientId, replace = false) {
  ownAccount(patientId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      return await runTransaction(db, async (tx) => {
        const profileRef = doc(db, 'users', patientId);
        const profile = (await tx.get(profileRef)).data();
        if (profile?.role !== 'patient') fail('family/role');
        const oldRef = profile.inviteCode ? doc(db, 'links', `invite_${profile.inviteCode}`) : null;
        const old = oldRef ? (await tx.get(oldRef)).data() : null;
        if (!replace && old?.kind === 'invite' && old.state === 'open' && millis(old.expiresAt) > Date.now()) return old;
        const ref = doc(db, 'links', `invite_${code}`);
        if ((await tx.get(ref)).exists()) fail('family/collision');
        const invite = { kind: 'invite', state: 'open', patientId, familyUserId: null, inviteCode: code,
          expiresAt: Timestamp.fromMillis(Date.now() + INVITE_LIFETIME) };
        // All reads precede writes so Firestore can safely retry this transaction.
        if (old?.state === 'open') tx.update(oldRef, { state: 'replaced' });
        tx.set(ref, { ...invite, createdAt: serverTimestamp() });
        tx.update(profileRef, { inviteCode: code });
        return invite;
      });
    } catch (error) { if (error.code !== 'family/collision') throw error; }
  }
  fail('family/collision');
}

export async function redeemInvite(familyUserId, input) {
  ownAccount(familyUserId);
  const code = normalizeInvite(input);
  return runTransaction(db, async (tx) => {
    const family = (await tx.get(doc(db, 'users', familyUserId))).data();
    if (family?.role !== 'family') fail('family/role');
    const invitationRef = doc(db, 'links', `invite_${code}`);
    const invitation = (await tx.get(invitationRef)).data();
    if (!invitation || invitation.kind !== 'invite') fail('family/unavailable-code');
    const patientId = invitation.patientId;
    if (patientId === familyUserId) fail('family/role');
    const patient = (await tx.get(doc(db, 'users', patientId))).data();
    if (patient?.role !== 'patient') fail('family/patient-missing');
    const linkRef = doc(db, 'links', `pair_${patientId}_${familyUserId}`);
    const existing = await tx.get(linkRef);
    if (invitation.state === 'used' && invitation.redeemedBy === familyUserId && existing.exists()) return linkRef.id;
    if (invitation.state !== 'open' || millis(invitation.expiresAt) <= Date.now()) fail('family/unavailable-code');
    if (!existing.exists()) tx.set(linkRef, {
      kind: 'link', patientId, familyUserId, inviteCode: code,
      patientName: patient.name, familyName: family.name, createdAt: serverTimestamp(),
    });
    tx.update(invitationRef, { state: 'used', redeemedBy: familyUserId, redeemedAt: serverTimestamp() });
    return linkRef.id;
  });
}

function watchConnections(field, uid, onChange, onError, database = db) {
  const records = query(collection(database, 'links'), where(field, '==', uid));
  return onSnapshot(records, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.hasPendingWrites) return;
    onChange({ records: snapshot.docs.map((item) => ({ ...item.data(), id: item.id })), fromCache: snapshot.metadata.fromCache });
  }, onError);
}
export const watchFamilyConnections = (uid, onChange, onError, database = db) => watchConnections('familyUserId', uid, onChange, onError, database);
export const watchPatientConnections = (uid, onChange, onError, database = db) => watchConnections('patientId', uid, onChange, onError, database);

// Optional database argument supports verification with an independent family session.
export function watchLinkedPatient(patientId, onChange, onError, database = db) {
  const state = { profile: null, medicines: [], logs: [], alerts: [], ready: false, fromCache: true, alertsFromCache: true };
  const loaded = new Set();
  const cache = new Map();
  let active = true;
  const subscriptions = [
    ['profile', doc(database, 'users', patientId)],
    ['medicines', query(collection(database, 'medicines'), where('patientId', '==', patientId))],
    ['logs', query(collection(database, 'doseLogs'), where('patientId', '==', patientId))],
    ['alerts', query(collection(database, 'alerts'), where('patientId', '==', patientId))],
  ].map(([key, ref]) => onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
    if (!active || snapshot.metadata.hasPendingWrites) return;
    state[key] = key === 'profile' ? (snapshot.exists() ? snapshot.data() : null)
      : snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
    loaded.add(key); cache.set(key, snapshot.metadata.fromCache);
    onChange({ ...state, ready: loaded.size === 4, fromCache: [...cache.values()].some(Boolean), alertsFromCache: cache.get('alerts') !== false });
  }, (error) => { if (active) onError(error); }));
  return () => { active = false; subscriptions.forEach((stop) => stop()); };
}
export const familyServices = { createInvite, redeemInvite, watchFamilyConnections, watchPatientConnections, watchLinkedPatient };
