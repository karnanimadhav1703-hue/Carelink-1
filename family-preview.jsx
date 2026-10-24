// Visual QA only: fictional data and in-memory listeners, never Firebase writes.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext';
import { ModeProvider } from '../src/context/ModeContext';
import { SpeechProvider } from '../src/context/SpeechContext';
import Layout from '../src/components/Layout';
import FamilyPage from '../src/pages/FamilyPage';
import FamilyConnectionsPage from '../src/pages/FamilyConnectionsPage';
import { isMode } from '../src/lib/modes';
import '../src/styles.css';

const params = new URLSearchParams(window.location.search);
const patient = params.get('role') === 'patient';
const mode = isMode(params.get('mode')) ? params.get('mode') : 'standard';
const now = Date.now();
const medicine = { id: 'm1', medicineId: 'm1', name: 'Example medicine', dose: 'Demo dose only', times: ['09:00', '18:00'] };
const location = { latitude: 28.6139, longitude: 77.209, capturedAt: now };
const hospital = { name: 'Example Community Hospital', latitude: 28.62, longitude: 77.21, distanceKm: .69 };
const link = { id: 'pair', kind: 'link', patientId: 'meena', familyUserId: 'son', patientName: 'Meena', familyName: 'Meena’s son', createdAt: now };
let connections = params.get('empty') ? [] : [link];
let patientRecords = [link];
let snapshot = { ready: true, fromCache: false, alertsFromCache: false, profile: { name: 'Meena', nearby: { nearestHospital: hospital, location, updatedAt: now } }, medicines: [medicine], logs: [{ id: 'dose1', medicineId: 'm1', medicineName: medicine.name, status: 'taken', scheduledTime: now }], alerts: [] };
const familyListeners = new Set(); const patientListeners = new Set(); const careListeners = new Set();
function watch(listeners, value, callback) { listeners.add(callback); callback(value()); return () => listeners.delete(callback); }
const services = {
  watchFamilyConnections: (_, callback) => watch(familyListeners, () => ({ records: connections, fromCache: false }), callback),
  watchPatientConnections: (_, callback) => watch(patientListeners, () => ({ records: patientRecords, fromCache: false }), callback),
  watchLinkedPatient: (_, callback) => watch(careListeners, () => snapshot, callback),
  redeemInvite: async () => { connections = [link]; familyListeners.forEach((callback) => callback({ records: connections, fromCache: false })); },
  createInvite: async () => { patientRecords = [link, { id: 'invite', kind: 'invite', state: 'open', inviteCode: 'ABCD2345', expiresAt: Date.now() + 86400000 }]; patientListeners.forEach((callback) => callback({ records: patientRecords, fromCache: false })); },
};
function addAlert(type) {
  const id = crypto.randomUUID();
  snapshot = { ...snapshot, alerts: [...snapshot.alerts, { id, type, createdAt: Date.now(), scheduledTime: now, location: type === 'missedDose' ? null : location, nearestHospital: type === 'missedDose' ? null : hospital, medicines: [medicine], doseLogId: id }] };
  if (type === 'missedDose') snapshot.logs = [...snapshot.logs, { id, medicineId: 'm1', medicineName: medicine.name, status: 'missed', scheduledTime: now }];
  careListeners.forEach((callback) => callback(snapshot));
}
function Preview() {
  return <><div style={{ padding: 12, background: '#fff2ca', color: '#302600' }}><p>UI TEST FIXTURE — fictional data; no Firebase writes.</p>{!patient && <>{['sos', 'fall', 'missedDose'].map((type) => <button key={type} style={{ margin: 4, padding: 8 }} onClick={() => addAlert(type)}>Test {type}</button>)}</>}</div>
    <MemoryRouter initialEntries={[patient ? '/patient/family' : '/family']}><AuthContext.Provider value={{ user: { uid: patient ? 'meena' : 'son' }, profile: { role: patient ? 'patient' : 'family', name: patient ? 'Meena' : 'Meena’s son', mode, modeSelected: true }, logout: async () => {} }}><ModeProvider><SpeechProvider><Routes><Route element={<Layout />}><Route path="/family" element={<FamilyPage services={services} />} /><Route path="/patient/family" element={<FamilyConnectionsPage services={services} />} /></Route></Routes></SpeechProvider></ModeProvider></AuthContext.Provider></MemoryRouter></>;
}
if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById('root'));
  root.render(<Preview />);
  import.meta.hot?.dispose(() => root.unmount());
}
