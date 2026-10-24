// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocFromServer, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { createUserProfile } from '../src/lib/database';
import { saveAppointment, updateAppointment, watchAppointments } from '../src/lib/appointmentDatabase';
import { appointmentReminders } from '../src/lib/appointments';
it.skipIf(process.env.CARELINK_LIVE_TEST !== '1')('saves, streams, reschedules, reminds, acknowledges and cancels a real appointment', async () => {
  let user; let stop = () => {};
  try {
    user = (await createUserWithEmailAndPassword(auth, `carelink-visit-${randomUUID()}@example.com`, `Qa!${randomBytes(24).toString('hex')}`)).user;
    await createUserProfile(user.uid, { name: 'Disposable appointment QA', role: 'patient' });
    let records = []; let listenerError;
    stop = watchAppointments(user.uid, (snapshot) => { if (!snapshot.fromCache) records = snapshot.records; }, (error) => { listenerError = error; });
    const id = await saveAppointment(user.uid, { doctor: 'Fictional clinic QA', scheduledTime: Date.now() + 7200000, reminderMinutes: 60 });
    const ref = doc(db, 'appointments', id);
    await expect.poll(() => records.length, { timeout: 15000 }).toBe(1);
    await saveAppointment(user.uid, { doctor: 'Rescheduled QA', scheduledTime: Date.now() + 1800000, reminderMinutes: 60 }, id);
    await expect.poll(() => records[0]?.revision, { timeout: 15000 }).toBe(2);
    const advance = appointmentReminders(records, Date.now())[0]; expect(advance.kind).toBe('advance');
    await updateAppointment(user.uid, id, 'acknowledge', advance);
    expect((await getDocFromServer(ref)).data().acknowledged.advance).toBe(true);
    await updateAppointment(user.uid, id, 'demo');
    expect((await getDocFromServer(ref)).data().demoAt.toMillis()).toBeGreaterThan(Date.now());
    // Backdate only the disposable QA record to verify catch-up without a long wait.
    await updateDoc(ref, { demoAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expect.poll(() => appointmentReminders(records, Date.now()).some((item) => item.kind.startsWith('demo_')), { timeout: 15000 }).toBe(true);
    const demo = appointmentReminders(records, Date.now()).find((item) => item.kind.startsWith('demo_'));
    await updateAppointment(user.uid, id, 'acknowledge', demo);
    await updateAppointment(user.uid, id, 'cancel');
    await expect.poll(() => records[0]?.status, { timeout: 15000 }).toBe('cancelled');
    expect(appointmentReminders(records, Date.now())).toEqual([]); expect(listenerError).toBeUndefined();
  } finally {
    stop();
    if (user) {
      const records = await getDocs(query(collection(db, 'appointments'), where('patientId', '==', user.uid)));
      await Promise.all(records.docs.map((item) => deleteDoc(item.ref)));
      await deleteDoc(doc(db, 'users', user.uid)); await deleteUser(user);
    }
  }
}, 90000);
