import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from './AuthContext';
import { saveUserLanguage } from '../lib/database';
import { getLanguage, isLanguage, setLanguage, subscribeLanguage, t } from '../lib/i18n';

const LanguageContext = createContext(null);
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en');
  const context = useContext(LanguageContext);
  return context || { language, chooseLanguage: setLanguage, busy: false, message: '', t };
}
export function LanguageProvider({ children, saveLanguage = saveUserLanguage }) {
  const { user, profile } = useAuth();
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, () => 'en');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const saving = useRef(false);
  useEffect(() => {
    generation.current++; saving.current = false; setBusy(false); setMessage('');
    return () => { generation.current++; };
  }, [user?.uid]);
  useEffect(() => {
    if (isLanguage(profile?.language)) setLanguage(profile.language);
  }, [user?.uid, profile?.language]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  async function chooseLanguage(value) {
    if (!isLanguage(value) || saving.current) return;
    setLanguage(value); setMessage('');
    if (!user || !profile) return;
    const request = generation.current;
    saving.current = true; setBusy(true);
    try {
      await saveLanguage(user.uid, value);
      if (request === generation.current) setMessage('Language saved to your profile.');
    } catch {
      if (request === generation.current) setMessage('Language changed on this device. Your profile could not be updated; reconnect and choose the language again.');
    } finally {
      if (request === generation.current) { saving.current = false; setBusy(false); }
    }
  }
  return <LanguageContext.Provider value={{ language, chooseLanguage, busy, message, t }}>{children}</LanguageContext.Provider>;
}
