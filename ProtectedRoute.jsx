import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { needsModeSelection } from '../lib/modes';

export const roleHome = (role) => role === 'family' ? '/family' : '/patient';

export default function ProtectedRoute({ role, requireMode = true }) {
  useLanguage();
  const { user, profile, loading, error } = useAuth();
  if (loading) return <p className="status-panel" role="status">{t("Opening your care space…")}</p>;
  if (error) return <div className="status-panel"><p role="alert">{t(error)}</p><button className="button mt-4" onClick={() => window.location.reload()}>{t("Try again")}</button></div>;
  if (!user || !profile) return <Navigate to="/login" replace />;
  if (profile.role !== role) return <Navigate to={roleHome(profile.role)} replace />;
  if (requireMode && needsModeSelection(profile)) return <Navigate to="/choose-mode" replace />;
  return <Outlet />;
}
