// @vitest-environment node
// Opt-in Firebase integration test. All records belong to a disposable QA account.
import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocFromServer, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { createUserProfile, watchPatientRecords } from '../src/lib/database';
import { addMedicine, recordDose, scheduleDemo } from '../src/lib/medicineDatabase';
import { doseId, MISSED_AFTER_MS } from '../src/lib/doses';

it.skipIf(process.env.CARELINK_LIVE_TEST !== '1')('persists medicines, Taken, and exactly one real-time missed alert under concurrent checks', async () => {
  let user;
  let stop = () => {};
  try {
    user = (await createUserWithEmailAndPassword(auth, `carelink-medicine-qa-${randomUUID()}@example.com`, `Qa!${randomBytes(24).toString('hex')}`)).user;
    await createUserProfile(user.uid, { name: 'Disposable medicine QA', role: 'patient' });
    const id = await addMedicine(user.uid, { name: 'QA example only', dose: 'Practice dose', times: ['09:00'] });
    const ref = doc(db, 'medicines', id);
    expect((await getDocFromServer(ref)).data().patientId).toBe(user.uid);
    const demoTime = await scheduleDemo(user.uid, id);
    expect(demoTime).toBeGreaterThan(Date.now() + 40000);
    await expect(scheduleDemo(user.uid, id)).rejects.toThrow('already has a demo');
    // Backdate only this QA record to exercise the actual 15-minute production threshold.
    const scheduledTime = Date.now() - MISSED_AFTER_MS - 1000;
    await updateDoc(ref, { createdAt: Timestamp.fromMillis(scheduledTime - 60000), demoAt: Timestamp.fromMillis(scheduledTime) });
    const medicine = { ...(await getDocFromServer(ref)).data(), id };
    const occurrence = { medicine, scheduledTime };
    const alerts = [];
    let listenerError;
    stop = watchPatientRecords('alerts', user.uid, (records) => alerts.splice(0, alerts.length, ...records), (err) => { listenerError = err; });
    const results = await Promise.all([
      recordDose(user.uid, occurrence, 'missed', 'Disposable medicine QA', [medicine]),
      recordDose(user.uid, occurrence, 'missed', 'Disposable medicine QA', [medicine]),
    ]);
    expect(results.sort()).toEqual([false, true]);
    await expect.poll(() => alerts.length, { timeout: 15000 }).toBe(1);
    expect(alerts[0]).toMatchObject({ patientId: user.uid, type: 'missedDose', demo: true, medicines: [{ medicineId: id, name: 'QA example only', dose: 'Practice dose', times: ['09:00'] }] });
    const log = doc(db, 'doseLogs', doseId(id, scheduledTime));
    expect((await getDocFromServer(log)).data().status).toBe('missed');
    await recordDose(user.uid, occurrence, 'taken', 'Disposable medicine QA', [medicine]);
    expect((await getDocFromServer(log)).data()).toMatchObject({ status: 'taken', wasMissed: true });
    expect((await getDocs(query(collection(db, 'alerts'), where('patientId', '==', user.uid)))).size).toBe(1);
    // A second dose taken promptly must not generate an alert.
    const promptTime = Date.now() - 1000;
    await updateDoc(ref, { demoAt: Timestamp.fromMillis(promptTime) });
    await recordDose(user.uid, { medicine, scheduledTime: promptTime }, 'taken', 'Disposable medicine QA', [medicine]);
    expect((await getDocFromServer(doc(db, 'doseLogs', doseId(id, promptTime)))).data()).toMatchObject({ status: 'taken', wasMissed: false });
    expect(listenerError).toBeUndefined();
  } finally {
    stop();
    if (user) {
      // Delete only this generated patient's records, including partial-test leftovers.
      for (const name of ['alerts', 'doseLogs', 'medicines']) {
        const records = await getDocs(query(collection(db, name), where('patientId', '==', user.uid)));
        await Promise.all(records.docs.map((item) => deleteDoc(item.ref)));
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
    }
  }
}, 90000);
