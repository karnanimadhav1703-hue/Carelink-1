import hindi from './hi.json';

export const LANGUAGE_KEY = 'carelink-language';
export const isLanguage = (value) => value === 'en' || value === 'hi';
let language = 'en';
try { const saved = localStorage.getItem(LANGUAGE_KEY); if (isLanguage(saved)) language = saved; } catch { /* Storage may be blocked. */ }
const listeners = new Set();
export const getLanguage = () => language;
export const getLocale = () => language === 'hi' ? 'hi-IN' : 'en-IN';
export const subscribeLanguage = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export function setLanguage(value) {
  if (!isLanguage(value)) return;
  language = value;
  try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Keep the choice for this session. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  listeners.forEach((listener) => listener());
}

// English phrases are the keys. Interpolation preserves names and clinical data
// exactly as entered; only our interface copy is translated.
export function translate(message, values = {}, selected = language) {
  if (message && typeof message === 'object' && typeof message.key === 'string') return translate(message.key, message.values, selected);
  if (typeof message !== 'string') return message;
  const key = message.trim();
  const translated = selected === 'hi' && Object.hasOwn(hindi, key) ? message.replace(key, () => hindi[key]) : message;
  return translated.replace(/\{(\w+)\}/g, (token, name) => Object.hasOwn(values, name) ? (values[name] && typeof values[name] === 'object' && values[name].key ? translate(values[name], {}, selected) : String(values[name])) : token);
}
export const t = translate;
