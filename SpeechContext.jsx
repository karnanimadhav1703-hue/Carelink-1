import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMode } from './ModeContext';
import { useLanguage } from './LanguageContext';
import { t } from '../lib/i18n';

const SpeechContext = createContext(null);
export const useSpeech = () => useContext(SpeechContext);
export function SpeechProvider({ children }) {
  const { language } = useLanguage();
  const supported = typeof window !== 'undefined' && typeof window.speechSynthesis?.speak === 'function'
    && typeof window.SpeechSynthesisUtterance === 'function';
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle');
  const active = useRef(null);
  const [voices, setVoices] = useState(() => window.speechSynthesis?.getVoices?.() || []);
  useEffect(() => {
    const update = () => setVoices(window.speechSynthesis?.getVoices?.() || []);
    window.speechSynthesis?.addEventListener?.('voiceschanged', update);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', update);
  }, []);
  const stop = useCallback(() => {
    // Old speech callbacks must not change the next screen's status.
    if (active.current) { active.current.onend = null; active.current.onerror = null; active.current.onstart = null; }
    active.current = null;
    if (supported) window.speechSynthesis.cancel();
    setStatus('idle');
  }, [supported]);
  const speak = useCallback((message) => {
    stop();
    if (!supported || !message) { setStatus('unavailable'); return; }
    try {
      const voice = voices.find((item) => item.lang.toLowerCase().startsWith(language));
      // Keep the written summary when the device has no Hindi voice installed.
      if (language === 'hi' && !voice) { setStatus('unavailable'); return; }
      const utterance = new window.SpeechSynthesisUtterance(t(message));
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.onstart = () => setStatus('speaking');
      utterance.onend = () => { active.current = null; setStatus('idle'); };
      utterance.onerror = (event) => {
        active.current = null;
        setStatus(['canceled', 'interrupted'].includes(event.error) ? 'idle' : 'unavailable');
      };
      active.current = utterance;
      setStatus('queued');
      window.speechSynthesis.speak(utterance);
    } catch { setStatus('unavailable'); }
  }, [stop, supported, language, voices]);
  useEffect(() => () => {
    if (active.current) { active.current.onend = null; active.current.onerror = null; active.current.onstart = null; }
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);
  return <SpeechContext.Provider value={{ supported, text, status, setText, speak, stop }}>{children}</SpeechContext.Provider>;
}

// Route summaries stay available as text when automatic speech is blocked.
export function useScreenSpeech(title, summary) {
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const { mode } = useMode();
  const { setText, speak, stop } = useSpeech();
  useEffect(() => {
    document.title = `${t(title)} · CareLink`;
    setText(t(summary));
    if (mode === 'vision-assist') speak(summary);
    else stop();
    return stop;
  }, [title, summary, pathname, mode, setText, speak, stop, language]);
}
