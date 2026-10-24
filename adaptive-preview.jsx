// Development-only UI fixture: no Auth operations, Firestore writes, or demo accounts.
// Vite's production entry is index.html; this fixture is not part of dist/.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext';
import { ModeProvider } from '../src/context/ModeContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { SpeechProvider } from '../src/context/SpeechContext';
import Layout from '../src/components/Layout';
import ProtectedRoute from '../src/components/ProtectedRoute';
import DashboardPage from '../src/pages/DashboardPage';
import ModePage from '../src/pages/ModePage';
import SettingsPage from '../src/pages/SettingsPage';
import FeaturePage from '../src/pages/FeaturePage';
import { isMode } from '../src/lib/modes';
import '../src/styles.css';

function Preview() {
  const selected = new URLSearchParams(window.location.search).get('mode');
  const [profile, setProfile] = useState({ name: 'Meena', role: 'patient', mode: isMode(selected) ? selected : 'standard', modeSelected: isMode(selected) });
  const [fail, setFail] = useState(false);
  async function saveMode(uid, mode) {
    if (fail) throw { code: 'permission-denied' };
    setProfile((old) => ({ ...old, mode, modeSelected: true }));
  }
  return <>
    <div style={{ padding: 12, background: '#fff2ca', color: '#302600', fontSize: 14 }}>
      UI TEST FIXTURE — not connected to Firebase. Changes reset on reload.
      <label style={{ display: 'block', paddingTop: 8 }}><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} /> Simulate a failed mode save</label>
    </div>
    <MemoryRouter initialEntries={['/patient']}><AuthContext.Provider value={{ user: profile ? { uid: 'ui-fixture' } : null, profile, loading: false, error: '', logout: async () => setProfile(null) }}>
      <LanguageProvider saveLanguage={async (_, language) => setProfile((old) => ({ ...old, language }))}><ModeProvider><SpeechProvider><Routes><Route element={<Layout />}>
        <Route index element={<Navigate to="/patient" replace />} />
        <Route path="/login" element={<p className="status-panel">Fixture signed out. Reload to start again.</p>} />
        <Route element={<ProtectedRoute role="patient" requireMode={false} />}><Route path="/choose-mode" element={<ModePage saveMode={saveMode} />} /></Route>
        <Route element={<ProtectedRoute role="patient" />}>
          <Route path="/patient" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage saveMode={saveMode} />} />
          <Route path="/patient/:feature" element={<FeaturePage />} />
        </Route>
      </Route></Routes></SpeechProvider></ModeProvider></LanguageProvider>
    </AuthContext.Provider></MemoryRouter>
  </>;
}
if (import.meta.env.DEV) {
  const root = createRoot(document.getElementById('root'));
  root.render(<Preview />);
  import.meta.hot?.dispose(() => root.unmount());
}
