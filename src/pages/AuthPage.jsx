import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { useAction } from '../lib/useAsync';
import { NotConfigured } from './PlainParts';
import '../styles/plain.css';

const MIN_PASSWORD = 8;

/** Vrací jen vnitřní cestu, aby odkaz nemohl přesměrovat na cizí web. */
function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/ucet';
}

export default function AuthPage() {
  const { configured, loading, user, signIn, signUp } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const { busy, error, run, clearError } = useAction();

  if (!configured) return <NotConfigured />;
  if (!loading && user) return <Navigate to={safeNext(params.get('next'))} replace />;

  const isSignup = mode === 'signup';

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
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
        <h1>{isSignup ? 'Registrace' : 'Přihlášení'}</h1>
        {needsConfirm ? (
          <p className="plain-notice" role="status">
            Poslali jsme ti email s odkazem. Po potvrzení se můžeš přihlásit.
          </p>
        ) : (
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
            {error && <p className="plain-error" role="alert">{error}</p>}
            <button type="submit" className="plain-btn plain-btn--primary" disabled={busy}>
              {busy ? 'Pracuji…' : isSignup ? 'Vytvořit účet' : 'Přihlásit se'}
            </button>
          </form>
        )}
        <button
          type="button"
          className="plain-link"
          onClick={() => {
            setMode(isSignup ? 'login' : 'signup');
            setNeedsConfirm(false);
            clearError();
          }}
        >
          {isSignup ? 'Už mám účet, přihlásit se' : 'Nemám účet, zaregistrovat se'}
        </button>
        <Link className="plain-link" to="/">Zpět do chaty</Link>
      </section>
    </main>
  );
}
