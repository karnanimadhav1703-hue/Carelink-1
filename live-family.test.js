// @vitest-environment node
// Two disposable accounts, with a genuinely separate authenticated family listener.
import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { deleteApp, getApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocFromServer, getDocs, getFirestore, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { createUserProfile } from '../src/lib/database';
import { createInvite, redeemInvite, watchFamilyConnections, watchLinkedPatient } from '../src/lib/familyDatabase';
import { addMedicine, recordDose } from '../src/lib/medicineDatabase';
import { saveEmergencyAlert, saveNearbySummary } from '../src/lib/emergencyDatabase';
import { MISSED_AFTER_MS } from '../src/lib/doses';

it.skipIf(process.env.CARELINK_LIVE_TEST !== '1')('connects patient and family, then streams Taken, missed dose, SOS, fall and hospital snapshots', async () => {
  const patientLogin = { email: `carelink-pair-p-${randomUUID()}@example.com`, password: `Qa!${randomBytes(24).toString('hex')}` };
  const familyLogin = { email: `carelink-pair-f-${randomUUID()}@example.com`, password: `Qa!${randomBytes(24).toString('hex')}` };
  let patient; let family; let familyApp; let familyAuth;
  let stopPatient = () => {}; let stopLinks = () => {};
  try {
    patient = (await createUserWithEmailAndPassword(auth, patientLogin.email, patientLogin.password)).user;
    await createUserProfile(patient.uid, { name: 'Disposable Meena QA', role: 'patient' });
    const invite = await createInvite(patient.uid);
    family = (await createUserWithEmailAndPassword(auth, familyLogin.email, familyLogin.password)).user;
    await createUserProfile(family.uid, { name: 'Disposable son QA', role: 'family' });
    const linkId = await redeemInvite(family.uid, invite.inviteCode);
    expect(await redeemInvite(family.uid, invite.inviteCode)).toBe(linkId);
    familyApp = initializeApp(getApp().options, `family-qa-${randomUUID()}`);
    familyAuth = getAuth(familyApp);
    await signInWithEmailAndPassword(familyAuth, familyLogin.email, familyLogin.password);
    const familyDb = getFirestore(familyApp);
    let observed = null; let connections = []; let listenerError;
    stopLinks = watchFamilyConnections(family.uid, (snapshot) => { connections = snapshot.records; }, (error) => { listenerError = error; }, familyDb);
    stopPatient = watchLinkedPatient(patient.uid, (snapshot) => { observed = snapshot; }, (error) => { listenerError = error; }, familyDb);
    await expect.poll(() => connections.length, { timeout: 15000 }).toBe(1);
    await expect.poll(() => observed?.ready && !observed.fromCache, { timeout: 15000 }).toBe(true);
    expect(observed.profile.name).toBe('Disposable Meena QA');
    await signInWithEmailAndPassword(auth, patientLogin.email, patientLogin.password);
    const medicineId = await addMedicine(patient.uid, { name: 'QA medicine only', dose: 'Practice only', times: ['09:00'] });
    const medicineRef = doc(db, 'medicines', medicineId);
    const takenTime = Date.now() - 1000;
    await updateDoc(medicineRef, { createdAt: Timestamp.fromMillis(takenTime - 60000), demoAt: Timestamp.fromMillis(takenTime) });
    const medicine = { ...(await getDocFromServer(medicineRef)).data(), id: medicineId };
    await recordDose(patient.uid, { medicine, scheduledTime: takenTime }, 'taken', 'Disposable Meena QA', [medicine]);
    await expect.poll(() => observed.logs.some((log) => log.status === 'taken'), { timeout: 15000 }).toBe(true);
    const missedTime = Date.now() - MISSED_AFTER_MS - 1000;
    await updateDoc(medicineRef, { createdAt: Timestamp.fromMillis(missedTime - 60000), demoAt: Timestamp.fromMillis(missedTime) });
    await recordDose(patient.uid, { medicine, scheduledTime: missedTime }, 'missed', 'Disposable Meena QA', [medicine]);
    await expect.poll(() => observed.alerts.some((alert) => alert.type === 'missedDose'), { timeout: 15000 }).toBe(true);
    expect(observed.logs.some((log) => log.status === 'missed')).toBe(true);
    const nearby = { location: { latitude: 28.6139, longitude: 77.209, accuracy: 25, capturedAt: Date.now() }, hospitals: [{ id: 'fixture', name: 'Fictional QA hospital', latitude: 28.62, longitude: 77.21, distanceKm: .7 }], locationStatus: 'ready', hospitalStatus: 'ready' };
    await saveNearbySummary(patient.uid, nearby);
    for (const type of ['sos', 'fall']) await saveEmergencyAlert(patient.uid, { id: randomUUID(), type, patientName: 'Disposable Meena QA' }, nearby);
    await expect.poll(() => observed.alerts.length, { timeout: 15000 }).toBe(3);
    await expect.poll(() => observed.profile.nearby?.nearestHospital?.name, { timeout: 15000 }).toBe('Fictional QA hospital');
    for (const alert of observed.alerts.filter((item) => item.type !== 'missedDose')) {
      expect(alert.medicines[0].name).toBe('QA medicine only'); expect(alert.location.latitude).toBe(28.6139);
    }
    await recordDose(patient.uid, { medicine, scheduledTime: missedTime }, 'taken', 'Disposable Meena QA', [medicine]);
    await expect.poll(() => observed.logs.some((log) => log.status === 'taken' && log.wasMissed), { timeout: 15000 }).toBe(true);
    expect(observed.alerts).toHaveLength(3); expect(listenerError).toBeUndefined();
  } finally {
    stopPatient(); stopLinks();
    if (patient) {
      for (const name of ['links', 'alerts', 'doseLogs', 'medicines']) {
        const records = await getDocs(query(collection(db, name), where('patientId', '==', patient.uid)));
        await Promise.all(records.docs.map((item) => deleteDoc(item.ref)));
      }
      await deleteDoc(doc(db, 'users', patient.uid));
    }
    if (family) await deleteDoc(doc(db, 'users', family.uid));
    if (family) await deleteUser(familyAuth?.currentUser || family);
    if (patient) await deleteUser(patient);
    if (familyApp) await deleteApp(familyApp);
  }
}, 120000);
