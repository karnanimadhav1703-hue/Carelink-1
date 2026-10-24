// Run manually with npm run seed:demo. Never import credentials into the web app.
// Re-running adds missing seed records; it never resets a teammate's demo activity.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDocFromServer, getDocsFromServer, getFirestore, collection, query, where, runTransaction, serverTimestamp, terminate } from 'firebase/firestore';

const config = Object.fromEntries(['apiKey','authDomain','projectId','appId'].map((key) => [key, process.env[`VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`]]));
if (Object.values(config).some((value) => !value)) throw new Error('Configure Firebase values in .env.local before seeding.');
const credentialFile = new URL('../.demo-accounts.local.json', import.meta.url);
let credentials;
try { credentials = JSON.parse(await readFile(credentialFile, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  credentials = { projectId: config.projectId, note: 'Fictional shared demo accounts. Keep this file out of version control and public Hosting.',
    patient: { email: 'demo-meena@carelink.example', password: `Demo!${randomBytes(18).toString('hex')}` },
    family: { email: 'demo-arjun@carelink.example', password: `Demo!${randomBytes(18).toString('hex')}` } };
  // Exclusive creation prevents two seed runs from generating different passwords.
  await writeFile(credentialFile, JSON.stringify(credentials, null, 2), { flag: 'wx', mode: 0o600 });
}
if (credentials.projectId !== config.projectId) throw new Error('Demo credential file belongs to another Firebase project.');
const app = initializeApp(config); const auth = getAuth(app); const db = getFirestore(app);
async function account(role, name, mode) {
  const login = credentials[role];
  let user;
  try { user = (await createUserWithEmailAndPassword(auth, login.email, login.password)).user; }
  catch (error) {
    if (error.code !== 'auth/email-already-in-use') throw error;
    user = (await signInWithEmailAndPassword(auth, login.email, login.password)).user;
  }
  login.uid = user.uid;
  await writeFile(credentialFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) {
      if (existing.data().demoSeed !== 'carelink-v1' || existing.data().role !== role) throw new Error('Refusing to overwrite a non-demo profile.');
    } else tx.set(ref, { name, role, mode, modeSelected: true, demoSeed: 'carelink-v1' });
  });
  return user.uid;
}
async function createMissing(ref, data) {
  await runTransaction(db, async (tx) => { if (!(await tx.get(ref)).exists()) tx.set(ref, data); });
}
try {
  const patientId = await account('patient', 'Meena', 'elderly');
  for (const [id, name, dose, times] of [
    ['morning', 'Demo medicine A', 'Practice dose — not for use', ['09:00']],
    ['evening', 'Demo medicine B', 'Practice dose — not for use', ['18:00']],
  ]) await createMissing(doc(db, 'medicines', `demo_${patientId}_${id}`), { patientId, name, dose, times, createdAt: serverTimestamp(), demoSeed: 'carelink-v1' });
  const familyUserId = await account('family', 'Arjun (Meena’s son)', 'standard');
  await createMissing(doc(db, 'links', `pair_${patientId}_${familyUserId}`), { kind: 'link', patientId, familyUserId, inviteCode: 'DEMOSEED', patientName: 'Meena', familyName: 'Arjun (Meena’s son)', createdAt: serverTimestamp(), demoSeed: 'carelink-v1' });
  const profile = await getDocFromServer(doc(db, 'users', patientId));
  const medicines = await getDocsFromServer(query(collection(db, 'medicines'), where('patientId', '==', patientId)));
  const link = await getDocFromServer(doc(db, 'links', `pair_${patientId}_${familyUserId}`));
  if (!profile.exists() || medicines.size < 2 || !link.exists()) throw new Error('Seed verification failed.');
  console.log(`Demo accounts verified in ${config.projectId}: Meena (${profile.data().mode}), Arjun, ${medicines.size} medicines, and their family link.`);
  console.log('Login details saved in .demo-accounts.local.json (not printed or published). Re-running preserves existing activity.');
} catch (error) {
  console.error(`Demo seeding failed: ${error.code || error.message}. Existing seed progress is preserved; rerun after resolving the issue.`);
  process.exitCode = 1;
} finally { await terminate(db); await deleteApp(app); }
