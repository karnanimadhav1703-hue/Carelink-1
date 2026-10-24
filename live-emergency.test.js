// @vitest-environment node
// Disposable QA account; coordinates below are a public city-center example, never device GPS.
import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocFromServer, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { createUserProfile, watchPatientRecords } from '../src/lib/database';
import { addMedicine } from '../src/lib/medicineDatabase';
import { saveEmergencyAlert, saveNearbySummary } from '../src/lib/emergencyDatabase';
it.skipIf(process.env.CARELINK_LIVE_TEST !== '1')('saves SOS/fall snapshots, deduplicates retries and delivers through the alert listener', async () => {
  let user; let stop = () => {};
  try {
    user = (await createUserWithEmailAndPassword(auth, `carelink-sos-qa-${randomUUID()}@example.com`, `Qa!${randomBytes(24).toString('hex')}`)).user;
    await createUserProfile(user.uid, { name: 'Disposable SOS QA', role: 'patient' });
    await addMedicine(user.uid, { name: 'QA example only', dose: 'Practice only', times: ['09:00'] });
    const result = { location: { latitude: 28.6139, longitude: 77.209, accuracy: 50, capturedAt: Date.now() }, hospitals: [{ id: 'node/qa', name: 'Fictional QA hospital', latitude: 28.614, longitude: 77.21, distanceKm: .1 }], locationStatus: 'ready', hospitalStatus: 'ready' };
    await saveNearbySummary(user.uid, result);
    expect((await getDocFromServer(doc(db, 'users', user.uid))).data().nearby.nearestHospital.name).toBe('Fictional QA hospital');
    const observed = [];
    stop = watchPatientRecords('alerts', user.uid, (records) => observed.splice(0, observed.length, ...records), () => {});
    const event = { id: randomUUID(), type: 'sos', patientName: 'Disposable SOS QA' };
    const ids = await Promise.all([saveEmergencyAlert(user.uid, event, result), saveEmergencyAlert(user.uid, event, result)]);
    expect(ids[0]).toBe(ids[1]);
    const alert = (await getDocFromServer(doc(db, 'alerts', ids[0]))).data();
    expect(alert).toMatchObject({ type: 'sos', simulated: false, patientName: 'Disposable SOS QA', location: result.location, nearestHospital: result.hospitals[0] });
    expect(alert.medicines).toHaveLength(1);
    expect(alert.medicines[0].name).toBe('QA example only');
    await expect.poll(() => observed.length, { timeout: 10000 }).toBe(1);
    await saveEmergencyAlert(user.uid, { ...event, id: randomUUID(), type: 'fall' }, { location: null, hospitals: [], locationStatus: 'denied', hospitalStatus: 'not-requested' });
    await expect.poll(() => observed.length, { timeout: 10000 }).toBe(2);
    expect(observed.find((item) => item.type === 'fall')).toMatchObject({ simulated: true, location: null, nearestHospital: null, locationStatus: 'denied' });
  } finally {
    stop();
    if (user) {
      for (const name of ['alerts', 'medicines']) {
        const records = await getDocs(query(collection(db, name), where('patientId', '==', user.uid)));
        await Promise.all(records.docs.map((item) => deleteDoc(item.ref)));
      }
      await deleteDoc(doc(db, 'users', user.uid)); await deleteUser(user);
    }
  }
}, 90000);
