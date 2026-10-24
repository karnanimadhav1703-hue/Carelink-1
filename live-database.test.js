// @vitest-environment node
// Opt-in only: creates one uniquely named disposable account and deletes its own data.
import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { deleteDoc, doc, getDocFromServer } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../src/lib/firebase';
import { createUserProfile, savePatientMode, watchUserProfile } from '../src/lib/database';

it.skipIf(process.env.CARELINK_LIVE_TEST !== '1')('saves and restores modes through the real Firebase project', async () => {
  expect(isFirebaseConfigured).toBe(true);
  let account;
  let stop = () => {};
  let profileCreated = false;
  try {
    account = (await createUserWithEmailAndPassword(auth, `carelink-qa-${randomUUID()}@example.com`, `Qa!${randomBytes(24).toString('hex')}`)).user;
    await createUserProfile(account.uid, { name: 'CareLink disposable QA', role: 'patient' });
    profileCreated = true;
    const observed = [];
    let listenerError;
    stop = watchUserProfile(account.uid, (profile) => observed.push(profile), (error) => { listenerError = error; });
    for (const mode of ['elderly', 'vision-assist', 'standard']) {
      await savePatientMode(account.uid, mode);
      const snapshot = await getDocFromServer(doc(db, 'users', account.uid));
      expect(snapshot.data()).toEqual({ name: 'CareLink disposable QA', role: 'patient', mode, modeSelected: true });
      await expect.poll(() => observed.some((profile) => profile?.mode === mode && profile.modeSelected), { timeout: 10000 }).toBe(true);
    }
    await createUserProfile(account.uid, { name: 'Must not overwrite', role: 'family' });
    expect((await getDocFromServer(doc(db, 'users', account.uid))).data().role).toBe('patient');
    expect(listenerError).toBeUndefined();
  } finally {
    stop();
    if (account) {
      try { if (profileCreated) await deleteDoc(doc(db, 'users', account.uid)); }
      finally { await deleteUser(account); }
    }
  }
}, 60000);
