import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useAction } from '../lib/useAsync';

export const MIN_PASSWORD = 8;

/** Nastavení nového hesla přihlášeného uživatele: ze stránky účtu i po odkazu z emailu. */
export default function PasswordForm({ onDone }) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState('');
  const { busy, error, run } = useAction();

  return (
    <form
      className="plain-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage('');
        run(async () => {
          if (password.length < MIN_PASSWORD) throw new Error(`Heslo musí mít aspoň ${MIN_PASSWORD} znaků.`);
          if (password !== again) throw new Error('Hesla se neshodují.');
          await updatePassword(password);
          setPassword('');
          setAgain('');
          setMessage('Heslo je změněné.');
          onDone?.();
        });
      }}
    >
      <h2>Změna hesla</h2>
      <label>
        Nové heslo
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
      </label>
      <label>
        Nové heslo znovu
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required autoComplete="new-password" />
      </label>
      {error && <p className="plain-error" role="alert">{error}</p>}
      {message && <p className="plain-muted" role="status">{message}</p>}
      <button type="submit" className="plain-btn" disabled={busy}>
        {busy ? 'Ukládám…' : 'Změnit heslo'}
      </button>
    </form>
  );
}
