// Visual QA only: fictional hospital/medicine data; no Firebase writes or device GPS.
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext';
import { ModeProvider } from '../src/context/ModeContext';
import { SpeechProvider } from '../src/context/SpeechContext';
import { EmergencyProvider } from '../src/context/EmergencyContext';
import { prepareNearby } from '../src/lib/nearby';
import Layout from '../src/components/Layout';
import HelpPage from '../src/pages/HelpPage';
import SosPage from '../src/pages/SosPage';
import DashboardPage from '../src/pages/DashboardPage';
import { isMode } from '../src/lib/modes';
import '../src/styles.css';
const location = { latitude: 28.6139, longitude: 77.209, accuracy: 25, capturedAt: Date.now() };
const hospitals = [
  { id: 'fixture-1', name: 'Example Community Hospital', latitude: 28.62, longitude: 77.21, distanceKm: .69 },
  { id: 'fixture-2', name: 'Example City Hospital', latitude: 28.63, longitude: 77.218, distanceKm: 1.99 },
];
function Preview() {
  const selected = new URLSearchParams(window.location.search);
  const [scenario, setScenario] = useState('ready');
  const [fail, setFail] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const mode = isMode(selected.get('mode')) ? selected.get('mode') : 'standard';
  const services = useMemo(() => ({
    prepareNearby: async ({ signal }) => {
      if (scenario === 'live') return prepareNearby({ signal, locate: async () => location });
      if (scenario === 'denied') return { location: null, hospitals: [], locationStatus: 'denied', hospitalStatus: 'not-requested' };
      return { location, hospitals: scenario === 'ready' ? hospitals : [], locationStatus: 'ready', hospitalStatus: scenario };
    },
    saveNearbySummary: async () => {},
    saveEmergencyAlert: async (patientId, event, result) => {
      if (fail) throw new Error('Simulated failed save');
      setAlerts((old) => old.some((alert) => alert.id === event.id) ? old : [...old, { id: event.id, type: event.type, result }]);
      return event.id;
    },
  }), [scenario, fail]);
  return <><div className="qa-controls" style={{ padding: 12, background: '#fff2ca', color: '#302600' }}>
    <p>UI TEST FIXTURE — no Firebase writes or device GPS. Map uses a public New Delhi example.</p>
    <label>Lookup scenario <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
      <option value="ready">Example hospitals</option><option value="denied">GPS denied</option><option value="empty">No results</option><option value="unavailable">Lookup unavailable</option><option value="live">Real Overpass: public city centre</option>
    </select></label><label style={{ display: 'block' }}><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} /> Simulate failed alert save</label>
    <p>Alerts saved in fixture: {alerts.length}{alerts.length > 0 && ` (${alerts.at(-1).type})`}</p>
  </div><MemoryRouter initialEntries={[selected.get('page') === 'sos' ? '/patient/sos' : '/patient/help']}>
    <AuthContext.Provider value={{ user: { uid: 'fixture-patient' }, profile: { role: 'patient', name: 'Meena', mode, modeSelected: true }, logout: async () => {} }}>
      <ModeProvider><SpeechProvider><EmergencyProvider services={services}>
        <Routes><Route element={<Layout />}><Route path="/patient" element={<DashboardPage />} /><Route path="/patient/help" element={<HelpPage />} /><Route path="/patient/sos" element={<SosPage />} /></Route></Routes>
      </EmergencyProvider></SpeechProvider></ModeProvider>
    </AuthContext.Provider>
  </MemoryRouter></>;
}
if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById('root'));
  root.render(<Preview />);
  import.meta.hot?.dispose(() => root.unmount());
}
