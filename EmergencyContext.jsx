import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useMode } from './ModeContext';
import { useSpeech } from './SpeechContext';
import { prepareNearby } from '../lib/nearby';
import { saveEmergencyAlert, saveNearbySummary } from '../lib/emergencyDatabase';
import { t } from '../lib/i18n';

export const EmergencyContext = createContext(null);
export const useEmergency = () => useContext(EmergencyContext);
export const emergencyServices = { prepareNearby, saveEmergencyAlert, saveNearbySummary };
const emptyNearby = { location: null, hospitals: [], locationStatus: 'idle', hospitalStatus: 'idle' };

export function EmergencyProvider({ children, services = emergencyServices }) {
  const { user, profile } = useAuth();
  return user && profile?.role === 'patient'
    ? <PatientEmergency key={user.uid} patientId={user.uid} patientName={profile.name} services={services}>{children}</PatientEmergency>
    : children;
}
function PatientEmergency({ patientId, patientName, services, children }) {
  const [nearby, setNearby] = useState(emptyNearby);
  const [locating, setLocating] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [state, setState] = useState({ phase: 'idle' });
  const currentEvent = useRef(null);
  const lookup = useRef(null);
  const recentLookup = useRef(null);
  const nearbyRef = useRef(emptyNearby);
  const controller = useRef(null);
  const mounted = useRef(false);
  const { mode } = useMode();
  const { speak } = useSpeech();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(currentEvent.current?.lookupTimer); currentEvent.current = null; controller.current?.abort(); };
  }, []);

  const refreshNearby = useCallback(() => {
    if (lookup.current) return lookup.current;
    // Reuse successful searches, but Retry after a failure must make a fresh request.
    if (recentLookup.current?.services === services && ['ready', 'empty'].includes(recentLookup.current.result.hospitalStatus) && Date.now() - recentLookup.current.completedAt < 30000) {
      return Promise.resolve(recentLookup.current.result);
    }
    controller.current = new AbortController();
    setLocating(true); setSyncError(''); setNearby(emptyNearby); nearbyRef.current = emptyNearby;
    const promise = services.prepareNearby({ signal: controller.current.signal, onProgress: (result) => {
      if (mounted.current) { nearbyRef.current = result; setNearby(result); }
    } }).catch(() => ({ ...emptyNearby, locationStatus: 'unavailable', hospitalStatus: 'unavailable' })).then((result) => {
      if (!mounted.current) return result;
      recentLookup.current = { services, completedAt: Date.now(), result };
      nearbyRef.current = result; setNearby(result); setLocating(false);
      // This summary write is independent: it must not block an SOS alert.
      services.saveNearbySummary(patientId, result).catch(() => {
        if (mounted.current) setSyncError('The nearby result is visible here, but could not be saved for family. Check your connection and find hospitals again.');
      });
      return result;
    }).finally(() => { if (lookup.current === promise) lookup.current = null; });
    lookup.current = promise;
    return promise;
  }, [patientId, services]);

  const send = useCallback(async (event) => {
    if (!mounted.current || currentEvent.current !== event || event.sending) return;
    event.sending = true;
    setState({ phase: 'sending', type: event.type });
    try {
      const result = await event.preparation;
      if (!mounted.current || currentEvent.current !== event) return;
      const id = await services.saveEmergencyAlert(patientId, event, result);
      if (!mounted.current || currentEvent.current !== event) return;
      setState({ phase: 'saved', type: event.type, id, result });
      if (mode === 'vision-assist') speak('Alert saved. This does not call emergency services. For an emergency, call 112.');
    } catch {
      if (mounted.current && currentEvent.current === event) setState({ phase: 'error', type: event.type });
    } finally { event.sending = false; }
  }, [patientId, services, mode, speak]);

  useEffect(() => {
    if (state.phase !== 'countdown') return;
    const event = currentEvent.current;
    const tick = () => {
      if (currentEvent.current !== event) return;
      const remaining = Math.max(0, Math.ceil((event.deadline - Date.now()) / 1000));
      if (!remaining) void send(event);
      else setState({ phase: 'countdown', type: event.type, remaining });
    };
    const timer = setInterval(tick, 200);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, [state.phase, send]);

  function start(type) {
    if (!['sos', 'fall'].includes(type) || currentEvent.current) return;
    const event = { id: crypto.randomUUID(), type, patientName, deadline: Date.now() + 10000, sending: false };
    currentEvent.current = event;
    // Help Near Me can wait for a slow server. SOS keeps its original 18-second
    // preparation ceiling and includes GPS already captured while hospitals load.
    event.preparation = Promise.race([refreshNearby(), new Promise((resolve) => {
      event.lookupTimer = setTimeout(() => resolve({ ...nearbyRef.current,
        locationStatus: nearbyRef.current.locationStatus === 'idle' ? 'unavailable' : nearbyRef.current.locationStatus,
        hospitalStatus: ['ready', 'empty'].includes(nearbyRef.current.hospitalStatus) ? nearbyRef.current.hospitalStatus : 'unavailable',
      }), 18000);
    })]).finally(() => clearTimeout(event.lookupTimer));
    setState({ phase: 'countdown', type, remaining: 10 });
    if (mode === 'vision-assist') speak(t('{type}. Are you okay? You have ten seconds to cancel. Otherwise CareLink will save an alert. For emergency services, call 112.', { type: t(type === 'fall' ? 'Simulated fall' : 'SOS') }));
  }
  function cancel() {
    if (state.phase !== 'countdown' || currentEvent.current?.sending) return;
    clearTimeout(currentEvent.current?.lookupTimer); currentEvent.current = null;
    setState({ phase: 'cancelled' });
    if (mode === 'vision-assist') speak('Cancelled. No emergency alert was created.');
  }
  function dismiss() {
    if (['countdown', 'sending'].includes(state.phase)) return;
    currentEvent.current = null; setState({ phase: 'idle' });
  }
  function retry() { if (state.phase === 'error' && currentEvent.current) void send(currentEvent.current); }
  return <EmergencyContext.Provider value={{ nearby, locating, syncError, state, start, cancel, dismiss, retry, refreshNearby }}>{children}</EmergencyContext.Provider>;
}
