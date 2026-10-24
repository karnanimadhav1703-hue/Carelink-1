import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useMode } from './ModeContext';
import { useSpeech } from './SpeechContext';
import { appointmentServices } from '../lib/appointmentDatabase';
import { appointmentLabel, appointmentReminders, appointmentTime } from '../lib/appointments';
import { notifyAppointment } from '../lib/notifications';
import { t } from '../lib/i18n';

export const AppointmentContext = createContext(null);
export const useAppointments = () => useContext(AppointmentContext);
export function AppointmentProvider({ children, services = appointmentServices }) {
  const { user, profile } = useAuth();
  return user && profile?.role === 'patient' ? <PatientAppointments key={user.uid} patientId={user.uid} services={services}>{children}</PatientAppointments> : children;
}
function PatientAppointments({ patientId, services, children }) {
  const [appointments, setAppointments] = useState([]);
  const [ready, setReady] = useState(false);
  const [cached, setCached] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const announced = useRef(new Set());
  const active = useRef(false);
  const { mode } = useMode(); const { speak } = useSpeech();
  useEffect(() => {
    active.current = true;
    const stop = services.watchAppointments(patientId, (snapshot) => {
      if (!active.current) return;
      setAppointments(snapshot.records); setCached(snapshot.fromCache); setReady(true);
    }, () => { if (active.current) setError('Appointment updates could not be read. Check your connection and reload.'); });
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 10000);
    window.addEventListener('focus', tick); document.addEventListener('visibilitychange', tick);
    return () => { active.current = false; stop(); clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [patientId, services]);
  const due = ready ? appointmentReminders(appointments, now) : [];
  useEffect(() => {
    if (cached) return; // Do not announce a speculative or stale schedule.
    const messages = [];
    for (const reminder of due) {
      if (announced.current.has(reminder.id)) continue;
      announced.current.add(reminder.id);
      let shown = false;
      try {
        const key = `carelink-appointment:${patientId}:${reminder.id}`;
        shown = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1');
      } catch { /* In-memory deduplication still works when storage is blocked. */ }
      if (shown) continue;
      messages.push(t('{reminder}. {name}. Visit scheduled for {time}.', { reminder: t(reminder.label), name: appointmentLabel(reminder.appointment), time: appointmentTime(reminder.appointment) }));
      notifyAppointment(reminder).catch(() => { if (active.current) setNotice('Browser notification could not be shown. The in-app appointment reminder is available.'); });
    }
    if (mode === 'vision-assist' && messages.length) speak(messages.join(' '));
  }, [appointments, now, ready, cached, mode, patientId, speak]);
  async function act(id, action, reminder) {
    setBusy(id); setError(''); setNotice('');
    try { await services.updateAppointment(patientId, id, action, reminder); }
    catch (err) { if (active.current) setError({ key: '{error} Check your connection and try again.', values: { error: { key: err.message || 'Could not save the appointment change.' } } }); }
    finally { if (active.current) setBusy(''); }
  }
  return <AppointmentContext.Provider value={{ appointments, ready, cached, now, due, error, notice, busy, act, save: (fields, id) => services.saveAppointment(patientId, fields, id) }}>{children}</AppointmentContext.Provider>;
}
