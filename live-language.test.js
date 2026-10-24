// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { deleteDoc, doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../src/lib/firebase';
import { createUserProfile, saveUserLanguage, watchUserProfile } from '../src/lib/database';
import { setLanguage } from '../src/lib/i18n';

it.skipIf(process.env.CARELINK_LIVE_TEST !== '1')('saves and streams language preferences without changing role or mode', async () => {
  let user; let stop = () => {};
  try {
    setLanguage('hi');
    user = (await createUserWithEmailAndPassword(auth, `carelink-language-${randomUUID()}@example.com`, `Qa!${randomBytes(24).toString('hex')}`)).user;
    await createUserProfile(user.uid, { name: 'Disposable language QA', role: 'patient' });
    const ref = doc(db, 'users', user.uid);
    expect((await getDocFromServer(ref)).data().language).toBe('hi');
    let latest; let listenerError;
    stop = watchUserProfile(user.uid, (profile) => { latest = profile; }, (error) => { listenerError = error; });
    await saveUserLanguage(user.uid, 'en');
    await expect.poll(() => latest?.language, { timeout: 15000 }).toBe('en');
    await saveUserLanguage(user.uid, 'hi');
    await expect.poll(() => latest?.language, { timeout: 15000 }).toBe('hi');
    expect((await getDocFromServer(ref)).data()).toMatchObject({ name: 'Disposable language QA', role: 'patient', mode: 'standard', modeSelected: false, language: 'hi' });
    expect(listenerError).toBeUndefined();
  } finally {
    stop(); setLanguage('en');
    if (user) { await deleteDoc(doc(db, 'users', user.uid)); await deleteUser(user); }
  }
}, 60000);
