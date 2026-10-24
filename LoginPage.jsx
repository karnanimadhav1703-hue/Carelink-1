import { useLanguage } from '../context/LanguageContext';
import { t } from '../lib/i18n';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured, missingConfig } from '../lib/firebase';
import { createUserProfile } from '../lib/database';
import { authMessage } from '../lib/authErrors';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../components/ProtectedRoute';

export default function LoginPage() {
  useLanguage();
  const { user, profile, loading, error: profileError } = useAuth();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // If Auth succeeded but the profile write failed, let the same user finish it.
  const completing = !!user && !profile && !profileError;
  const needsProfile = creating || completing;

  async function submit(event) {
    event.preventDefault();
    if (busy || !isFirebaseConfigured || profileError) return;
    if (needsProfile && !name.trim()) { setError('Please enter your name.'); return; }
    setBusy(true);
    setError('');
    try {
      if (needsProfile) {
        const account = user || (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
        // The document ID is always the Firebase Authentication UID.
        await createUserProfile(account.uid, { name: name.trim(), role });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // AuthContext redirects only after the profile listener has returned.
    } catch (err) { setError(authMessage(err)); }
    finally { setBusy(false); }
  }

  if (loading && !busy) return <p className="status-panel" role="status">{t("Opening your care space…")}</p>;
  if (user && profile && !profileError) return <Navigate to={roleHome(profile.role)} replace />;

  return (
    <div className="welcome-grid">
      <section className="welcome-copy" aria-labelledby="welcome-title">
        <div className="eyebrow"><span className="status-dot" />{t(" EVERYDAY CARE, CONNECTED")}</div>
        <h1 id="welcome-title">{t("A little support.")}<br /><span>{t("A closer connection.")}</span></h1>
        <p className="intro">{t("One place for your everyday care, with family by your side.")}</p>
        <div className="connection-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="person-chip patient-chip"><span className="avatar">M</span><div>{t("Meena")}<small>{t("Your care")}</small></div><span className="chip-dot" /></div>
          <div className="connection-heart">♡</div>
          <div className="person-chip family-chip"><span className="avatar avatar-family">F</span><div>{t("Family")}<small>{t("By your side")}</small></div><span className="chip-dot" /></div>
          <span className="art-caption">{t("Your day. Your pace. Your people.")}</span>
        </div>
        <p className="welcome-note">{t("Designed for everyday users, older adults, and people with visual impairments.")}</p>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <span className="eyebrow">{t("YOUR CARE SPACE")}</span>
        <h2 id="auth-title">{completing ? t("Finish your profile") : creating ? t("Let’s get connected") : t("Welcome to CareLink")}</h2>
        <p className="muted">{completing ? t("Your account is ready. Add your name and role to continue.") : t("Start with you. Stay connected to family.")}</p>
        {!completing && <div className="auth-switch" role="group" aria-label={t("Account action")}>
          <button type="button" aria-pressed={!creating} disabled={busy} onClick={() => { setCreating(false); setError(''); }}>{t("Sign in")}</button>
          <button type="button" aria-pressed={creating} disabled={busy} onClick={() => { setCreating(true); setError(''); }}>{t("Create account")}</button>
        </div>}
        {!isFirebaseConfigured && <div className="setup-message" role="status"><strong>{t("Connect Firebase to begin")}</strong><p>{t("Add your Firebase web app values to ")}<code>{t(".env.local")}</code>{t(", then restart Vite. Missing: ")}{missingConfig.join(', ')}{t(". See README.md for setup.")}</p></div>}
        <form onSubmit={submit} aria-busy={busy} className="space-y-5 mt-6">
          {needsProfile && <>
            <label className="field">{t("Your name")}<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required disabled={busy} placeholder={t("e.g. Meena")} /></label>
            <fieldset disabled={busy}><legend className="field-label">{t("I’m here for")}</legend><div className="role-options">
              <label className="role-option"><input type="radio" name="role" value="patient" checked={role === 'patient'} onChange={() => setRole('patient')} /><span>{t("My care")}<small>{t("Patient account")}</small></span></label>
              <label className="role-option"><input type="radio" name="role" value="family" checked={role === 'family'} onChange={() => setRole('family')} /><span>{t("My family")}<small>{t("Family account")}</small></span></label>
            </div></fieldset>
          </>}
          {!completing && <>
            <label className="field">{t("Email address")}<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} placeholder="you@example.com" /></label>
            <label className="field">{t("Password")}<input type="password" autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required disabled={busy} placeholder={creating ? t("At least 6 characters") : t("Enter your password")} /></label>
          </>}
          {(error || profileError) && <p className="error-message" role="alert">{t(error || profileError)}</p>}
          <button className="button w-full" disabled={busy || !isFirebaseConfigured || !!profileError} type="submit">{busy ? t("Please wait…") : completing ? t("Save profile") : creating ? t("Create account") : t("Sign in")}<span aria-hidden="true"> →</span></button>
        </form>
        {profileError && <button className="text-button mt-4" onClick={() => window.location.reload()}>{t("Retry connection")}</button>}
        <p className="form-note">{t("A simpler way to keep care connected.")}</p>
      </section>
    </div>
  );
}
