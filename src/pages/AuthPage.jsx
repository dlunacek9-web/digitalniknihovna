import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { useAction } from '../lib/useAsync';
import { NotConfigured } from './PlainParts';
import { MIN_PASSWORD } from './PasswordForm';
import '../styles/plain.css';

const TITLES = { login: 'Přihlášení', signup: 'Registrace', reset: 'Zapomenuté heslo' };
const SUBMIT_LABELS = { login: 'Přihlásit se', signup: 'Vytvořit účet', reset: 'Poslat odkaz' };

/** Vrací jen vnitřní cestu, aby odkaz nemohl přesměrovat na cizí web. */
function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function AuthPage() {
  const { configured, loading, user, signIn, signUp, signInWithGoogle, requestPasswordReset } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { busy, error, run, clearError } = useAction();

  if (!configured) return <NotConfigured />;
  if (!loading && user) return <Navigate to={safeNext(params.get('next'))} replace />;

  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';
  const finished = needsConfirm || resetSent;

  const switchMode = (next) => {
    setMode(next);
    setNeedsConfirm(false);
    setResetSent(false);
    clearError();
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (isReset) {
        await requestPasswordReset(email.trim());
        setResetSent(true);
        return;
      }
      if (!isSignup) {
        await signIn(email.trim(), password);
        return;
      }
      if (password.length < MIN_PASSWORD) throw new Error(`Heslo musí mít aspoň ${MIN_PASSWORD} znaků.`);
      setNeedsConfirm(await signUp(name.trim(), email.trim(), password));
    });
  };

  return (
    <main className="plain plain--center">
      <section className="plain-card plain-card--narrow">
        <h1>{TITLES[mode]}</h1>
        {needsConfirm && (
          <p className="plain-notice" role="status">
            Poslali jsme ti email s odkazem. Po potvrzení se můžeš přihlásit.
          </p>
        )}
        {resetSent && (
          <p className="plain-notice" role="status">
            Pokud účet s tímto emailem existuje, poslali jsme na něj odkaz pro nastavení nového hesla. Otevři ho v tomto prohlížeči.
          </p>
        )}
        {!finished && (
          <form className="plain-form" onSubmit={submit}>
            {isSignup && (
              <label>
                Jméno
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            {!isReset && (
              <label>
                Heslo
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                />
              </label>
            )}
            {error && <p className="plain-error" role="alert">{error}</p>}
            <button type="submit" className="plain-btn plain-btn--primary" disabled={busy}>
              {busy ? 'Pracuji…' : SUBMIT_LABELS[mode]}
            </button>
          </form>
        )}
        {!finished && !isReset && (
          <>
            <p className="plain-muted" style={{ textAlign: 'center', margin: 0 }}>nebo</p>
            <button
              type="button"
              className="plain-btn"
              disabled={busy}
              onClick={() => run(signInWithGoogle)}
            >
              Pokračovat přes Google
            </button>
          </>
        )}
        {mode === 'login' && (
          <button type="button" className="plain-link" onClick={() => switchMode('reset')}>
            Zapomenuté heslo
          </button>
        )}
        <button
          type="button"
          className="plain-link"
          onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Nemám účet, zaregistrovat se' : isSignup ? 'Už mám účet, přihlásit se' : 'Zpět na přihlášení'}
        </button>
      </section>
    </main>
  );
}
