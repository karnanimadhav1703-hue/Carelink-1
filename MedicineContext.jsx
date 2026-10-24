import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useMode } from './ModeContext';
import { useSpeech } from './SpeechContext';
import { watchPatientRecords } from '../lib/database';
import { recordDose } from '../lib/medicineDatabase';
import { MISSED_AFTER_MS, occurrences } from '../lib/doses';
import { notifyDose } from '../lib/notifications';
import { t } from '../lib/i18n';

export const MedicineContext = createContext(null);
export const useMedicines = () => useContext(MedicineContext);
export function MedicineProvider({ children }) {
  const { user, profile } = useAuth();
  return user && profile?.role === 'patient'
    ? <PatientMedicines key={user.uid} patientId={user.uid} patientName={profile.name}>{children}</PatientMedicines>
    : children;
}

function PatientMedicines({ patientId, patientName, children }) {
  const [medicines, setMedicines] = useState(null);
  const [logs, setLogs] = useState(null);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const announced = useRef(new Set());
  const pending = useRef(new Set());
  const retries = useRef(new Map());
  const mounted = useRef(false);
  const { mode } = useMode();
  const { speak } = useSpeech();
  useEffect(() => {
    mounted.current = true;
    const onError = () => setError('Could not sync medicines. Check your connection and Firestore access, then reload.');
    const stopMedicines = watchPatientRecords('medicines', patientId, setMedicines, onError);
    const stopLogs = watchPatientRecords('doseLogs', patientId, setLogs, onError);
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 10000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { mounted.current = false; stopMedicines(); stopLogs(); clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [patientId]);
  const doses = useMemo(() => occurrences(medicines || [], now), [medicines, now]);
  const logById = useMemo(() => new Map((logs || []).map((log) => [log.id, log])), [logs]);
  const ready = medicines !== null && logs !== null;
  const due = ready ? doses.filter((dose) => dose.scheduledTime <= now && !logById.has(dose.id)) : [];

  useEffect(() => {
    const messages = [];
    for (const dose of due) {
      if (now >= dose.scheduledTime + MISSED_AFTER_MS) {
        if (pending.current.has(dose.id) || now < (retries.current.get(dose.id) || 0)) continue;
        pending.current.add(dose.id);
        recordDose(patientId, dose, 'missed', patientName, medicines).then(() => {
          if (mounted.current) setError('');
        }).catch(() => {
          retries.current.set(dose.id, Date.now() + 30000);
          if (mounted.current) setError('A missed-dose alert could not be saved. Keep CareLink open and reconnect; it will retry.');
        }).finally(() => pending.current.delete(dose.id));
      } else if (!announced.current.has(dose.id)) {
        announced.current.add(dose.id);
        // Session storage avoids replaying notifications after a page reload.
        const key = `carelink-reminded:${patientId}:${dose.id}`;
        let alreadyShown = false;
        try { alreadyShown = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); } catch { /* Storage can be blocked; in-memory dedupe still works. */ }
        if (!alreadyShown) {
          messages.push(t('{reminder}. {name}, {dose}. Scheduled dose is due. Select Taken to log it.', { reminder: t(dose.demo ? 'Demo reminder' : 'Medicine reminder'), name: dose.medicine.name, dose: dose.medicine.dose }));
          notifyDose(dose).catch(() => { if (mounted.current) setNotice('Browser notification could not be shown. Your in-app reminder is still available.'); });
        }
      }
    }
    if (mode === 'vision-assist' && messages.length) speak(messages.join(' '));
  }, [doses, logs, now, mode, patientId, patientName, medicines, speak]); // due is derived from these inputs.

  async function take(dose) {
    setBusy(dose.id); setError('');
    try {
      await recordDose(patientId, dose, 'taken', patientName, medicines);
      setNotice({ key: '{name}: dose recorded as taken.', values: { name: dose.medicine.name } });
    } catch { setError('Could not save Taken. Check your connection and try again.'); }
    finally { setBusy(''); }
  }
  return <MedicineContext.Provider value={{ medicines: medicines || [], logs: logs || [], doses, due, logById, now, ready, error, notice, busy, take }}>{children}</MedicineContext.Provider>;
}
