// Development-only visual fixture. No Firebase access or actual medicine instructions.
// Production scheduling is exercised by MedicineContext.test.jsx and live-medicines.test.js.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext';
import { ModeProvider } from '../src/context/ModeContext';
import { SpeechProvider } from '../src/context/SpeechContext';
import { MedicineContext } from '../src/context/MedicineContext';
import Layout from '../src/components/Layout';
import MedicinesPage from '../src/pages/MedicinesPage';
import { occurrences } from '../src/lib/doses';
import { isMode } from '../src/lib/modes';
import '../src/styles.css';

function Preview() {
  const selected = new URLSearchParams(window.location.search).get('mode');
  const [now] = useState(Date.now);
  const [medicines, setMedicines] = useState([{ id: 'fixture', name: 'Example medicine', dose: 'Practice dose only', times: ['09:00', '18:00'], createdAt: now - 1000, demoAt: now - 500 }]);
  const [logs, setLogs] = useState([]);
  const [notice, setNotice] = useState('');
  const doses = occurrences(medicines, now);
  const logById = new Map(logs.map((log) => [log.id, log]));
  const due = doses.filter((dose) => dose.scheduledTime <= now && !logById.has(dose.id));
  const profile = { role: 'patient', name: 'Meena', mode: isMode(selected) ? selected : 'standard', modeSelected: true };
  async function take(item) {
    setLogs([...logs, { id: item.id, medicineName: item.medicine.name, scheduledTime: item.scheduledTime, status: 'taken', demo: item.demo }]);
    setNotice(`${item.medicine.name}: dose recorded as taken.`);
  }
  async function saveMedicine(patientId, fields) { setMedicines([...medicines, { ...fields, patientId, id: `fixture-${medicines.length}`, createdAt: now }]); }
  async function setDemo(patientId, id) { setMedicines(medicines.map((medicine) => medicine.id === id ? { ...medicine, demoAt: now + 60000 } : medicine)); return now + 60000; }
  return <><div style={{ padding: 12, background: '#fff2ca', color: '#302600' }}>UI TEST FIXTURE — local sample data. No Firebase writes.</div>
    <MemoryRouter initialEntries={['/patient/medicines']}><AuthContext.Provider value={{ user: { uid: 'fixture-patient' }, profile, logout: async () => {} }}><ModeProvider><SpeechProvider>
      <MedicineContext.Provider value={{ medicines, logs, now, doses, due, logById, ready: true, error: '', notice, busy: '', take }}>
        <Routes><Route element={<Layout />}><Route path="/patient/medicines" element={<MedicinesPage saveMedicine={saveMedicine} setDemo={setDemo} />} /></Route></Routes>
      </MedicineContext.Provider>
    </SpeechProvider></ModeProvider></AuthContext.Provider></MemoryRouter>
  </>;
}
if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById('root'));
  root.render(<Preview />);
  import.meta.hot?.dispose(() => root.unmount());
}
