import { useLanguage } from './context/LanguageContext';
import { t } from './lib/i18n';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ModePage from './pages/ModePage';
import SettingsPage from './pages/SettingsPage';
import FeaturePage from './pages/FeaturePage';
import MedicinesPage from './pages/MedicinesPage';
import AppointmentsPage from './pages/AppointmentsPage';
import HelpPage from './pages/HelpPage';
import SosPage from './pages/SosPage';
import FamilyPage from './pages/FamilyPage';
import FamilyConnectionsPage from './pages/FamilyConnectionsPage';
import { useScreenSpeech } from './context/SpeechContext';

function NotFoundPage() {
  useLanguage();
  useScreenSpeech('Page not found', 'Page not found. Select Back to CareLink to return home. For an emergency, call 112.');
  return <section className="status-panel"><h1>{t('Page not found')}</h1><Link className="button mt-6" to="/">{t('Back to CareLink')}</Link></section>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<ProtectedRoute role="patient" requireMode={false} />}><Route path="choose-mode" element={<ModePage />} /></Route>
        <Route element={<ProtectedRoute role="patient" />}>
          <Route path="patient" element={<DashboardPage />} />
          <Route path="patient/medicines" element={<MedicinesPage />} />
          <Route path="patient/appointments" element={<AppointmentsPage />} />
          <Route path="patient/help" element={<HelpPage />} />
          <Route path="patient/sos" element={<SosPage />} />
          <Route path="patient/family" element={<FamilyConnectionsPage />} />
          <Route path="patient/:feature" element={<FeaturePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute role="family" />}><Route path="family" element={<FamilyPage />} /></Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
