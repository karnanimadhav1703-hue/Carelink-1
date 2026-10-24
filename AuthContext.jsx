import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { watchUserProfile } from '../lib/database';
import { authMessage } from '../lib/authErrors';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, profile: null, loading: isFirebaseConfigured, error: '' });

  useEffect(() => {
    if (!auth) return;
    let stopProfile = () => {};
    let generation = 0;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopProfile();
      const current = ++generation;
      setState({ user, profile: null, loading: !!user, error: '' });
      if (!user) return;

      // Read the role from Firestore, never from a role selector at sign-in.
      stopProfile = watchUserProfile(user.uid, (profile) => {
        if (current !== generation) return;
        const valid = !profile || ['patient', 'family'].includes(profile.role);
        setState({ user, profile, loading: false, error: valid ? '' : 'This profile has an invalid role. Ask the project owner to correct it.' });
      }, (error) => {
        if (current === generation) setState({ user, profile: null, loading: false, error: authMessage(error) });
      });
    }, (error) => setState({ user: null, profile: null, loading: false, error: authMessage(error) }));
    return () => { generation++; stopAuth(); stopProfile(); };
  }, []);

  return <AuthContext.Provider value={{ ...state, logout: () => signOut(auth) }}>{children}</AuthContext.Provider>;
}
