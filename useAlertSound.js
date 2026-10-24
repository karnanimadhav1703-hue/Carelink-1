import { useCallback, useEffect, useRef, useState } from 'react';

export function playAlertTone(context) {
  if (!context || context.state !== 'running') return false;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const time = context.currentTime;
  oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(660, time);
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(0.08, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(time); oscillator.stop(time + 0.4);
  return true;
}
export function useAlertSound() {
  const context = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('Enable sound for an audible alert while this dashboard is open.');
  useEffect(() => () => { void context.current?.close().catch(() => {}); context.current = null; }, []);
  const play = useCallback(() => {
    if (!context.current) return;
    try {
      if (!playAlertTone(context.current)) { setEnabled(false); setMessage('Sound is paused by the browser. Enable it again; visual banners still work.'); }
    } catch { setEnabled(false); setMessage('Sound is unavailable. Visual alert banners still work.'); }
  }, []);
  async function enable() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('unsupported');
      // Creation/resume happens only inside this explicit button gesture.
      if (!context.current || context.current.state === 'closed') context.current = new Audio();
      await context.current.resume();
      if (!playAlertTone(context.current)) throw new Error('blocked');
      setEnabled(true); setMessage('Sound enabled. A short test tone played. Keep the dashboard open.');
    } catch { setEnabled(false); setMessage('Sound could not be enabled in this browser. Visual alert banners still work.'); }
  }
  function mute() { const previous = context.current; context.current = null; void previous?.close().catch(() => {}); setEnabled(false); setMessage('Sound muted. Visual alert banners remain enabled.'); }
  return { enabled, message, enable, mute, play };
}
