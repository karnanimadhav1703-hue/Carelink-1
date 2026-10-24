import { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { isMode } from '../lib/modes';

const ModeContext = createContext(null);
export const useMode = () => useContext(ModeContext);
export function ModeProvider({ children }) {
  const { profile } = useAuth();
  const [previewMode, setPreviewMode] = useState(null);
  const savedMode = profile?.role === 'patient' && isMode(profile.mode) ? profile.mode : 'standard';
  const mode = profile?.role === 'patient' ? previewMode || savedMode : 'standard';
  return <ModeContext.Provider value={{ mode, savedMode, setPreviewMode }}>{children}</ModeContext.Provider>;
}
