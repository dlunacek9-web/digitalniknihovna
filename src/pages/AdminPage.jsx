import React, { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { useAction, useAsync } from '../lib/useAsync';
import { deleteLibrary, deleteUser, isAppAdmin, listAllLibraries, listAllUsers } from '../services/adminApi';
import { ConfirmButton, LoadState, NotConfigured, PageLoading } from './PlainParts';
import '../styles/plain.css';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('cs-CZ') : '–');

function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  return (
    <main className="plain plain--center">
      <section className="plain-card plain-card--narrow">
        <h1>Správa aplikace</h1>
        <form
          className="plain-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => signIn(email.trim(), password));
          }}
        >
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Heslo
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error && <p className="plain-error" role="alert">{error}</p>}
          <button type="submit" className="plain-btn plain-btn--primary" disabled={busy}>
            {busy ? 'Přihlašuji…' : 'Přihlásit'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Panel({ user, signOut }) {
  const users = useAsync(listAllUsers, []);
  const libs = useAsync(listAllLibraries, []);
  const { busy, error, run } = useAction();

  const remove = (fn, id) => run(async () => {
    await fn(id);
    await Promise.all([users.reload(), libs.reload()]);
  });

  return (
    <main className="plain" style={{ padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header className="plain-actions" style={{ justifyContent: 'space-between' }}>
          <h1>Správa aplikace</h1>
          <span className="plain-actions">
            <span className="plain-muted">{user.email}</span>
            <Link className="plain-link" to="/">Do aplikace</Link>
            <button type="button" className="plain-btn" onClick={() => signOut()}>Odhlásit</button>
          </span>
        </header>
        {error && <p className="plain-error" role="alert">{error}</p>}

        <section className="plain-card" style={{ width: '100%', overflowX: 'auto' }}>
          <h2>Knihovny ({libs.data?.length ?? '…'})</h2>
          <LoadState loading={libs.loading} error={libs.error} hasData={Boolean(libs.data)} onRetry={libs.reload}>
            <table className="plain-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr><th>Název</th><th>Město</th><th>Zakladatel</th><th>Založena</th><th>Zam.</th><th>Knih</th><th>Výp.</th><th /></tr>
              </thead>
              <tbody>
                {(libs.data || []).map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td><td>{l.city || '–'}</td><td>{l.created_by_name || '–'}</td>
                    <td>{fmt(l.created_at)}</td><td>{l.staff_count}</td><td>{l.item_count}</td><td>{l.loan_count}</td>
                    <td>
                      <ConfirmButton disabled={busy} confirmLabel="Smazat i s knihami?" onConfirm={() => remove(deleteLibrary, l.id)}>
                        Smazat
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </LoadState>
        </section>

        <section className="plain-card" style={{ width: '100%', overflowX: 'auto' }}>
          <h2>Účty ({users.data?.length ?? '…'})</h2>
          <LoadState loading={users.loading} error={users.error} hasData={Boolean(users.data)} onRetry={users.reload}>
            <table className="plain-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr><th>Jméno</th><th>Email</th><th>Knihovny</th><th>Registrace</th><th>Poslední přihlášení</th><th>Výp.</th><th /></tr>
              </thead>
              <tbody>
                {(users.data || []).map((u) => (
                  <tr key={u.id}>
                    <td>{u.name || '–'}</td>
                    <td>{u.email}{!u.email_confirmed && ' (nepotvrzený)'}</td>
                    <td>{u.libraries || '–'}</td>
                    <td>{fmt(u.created_at)}</td><td>{fmt(u.last_sign_in_at)}</td><td>{u.loan_count}</td>
                    <td>
                      {u.id !== user.id && (
                        <ConfirmButton disabled={busy} confirmLabel="Smazat účet?" onConfirm={() => remove(deleteUser, u.id)}>
                          Smazat
                        </ConfirmButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </LoadState>
        </section>
      </div>
    </main>
  );
}

export default function AdminPage() {
  const { configured, loading, user, signOut } = useAuth();
  const check = useAsync(() => (user ? isAppAdmin() : Promise.resolve(false)), [user?.id]);

  if (!configured) return <NotConfigured />;
  if (loading || (user && check.loading && check.data == null)) return <PageLoading />;
  if (!user) return <LoginForm />;
  if (!check.data) {
    return (
      <main className="plain plain--center">
        <section className="plain-card plain-card--narrow">
          <h1>Přístup odepřen</h1>
          <p>Tento účet není správce aplikace.</p>
          <button type="button" className="plain-btn" onClick={() => signOut()}>Odhlásit</button>
        </section>
      </main>
    );
  }
  return <Panel user={user} signOut={signOut} />;
}
