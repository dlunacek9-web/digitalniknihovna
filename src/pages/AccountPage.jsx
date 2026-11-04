import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { useAction } from '../lib/useAsync';
import { createLibrary, redeemInvite } from '../services/publicLibraryApi';
import { NotConfigured, PageLoading } from './PlainParts';
import '../styles/plain.css';

function CreateLibraryForm({ onDone }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const { busy, error, run } = useAction();

  return (
    <form
      className="plain-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await createLibrary({ name, address, city });
          await onDone();
        });
      }}
    >
      <h2>Založit školní knihovnu</h2>
      <label>
        Název knihovny
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </label>
      <label>
        Adresa
        <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
      </label>
      <label>
        Město
        <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
      </label>
      {error && <p className="plain-error" role="alert">{error}</p>}
      <button type="submit" className="plain-btn plain-btn--primary" disabled={busy}>
        {busy ? 'Zakládám…' : 'Založit knihovnu'}
      </button>
    </form>
  );
}

function RedeemInviteForm({ onDone }) {
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();

  return (
    <form
      className="plain-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await redeemInvite(code);
          await onDone();
        });
      }}
    >
      <h2>Zadat pozvánkový kód</h2>
      <label>
        Kód od správce knihovny
        <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="XXXX-XXXX-XXXX" autoComplete="off" />
      </label>
      {error && <p className="plain-error" role="alert">{error}</p>}
      <button type="submit" className="plain-btn" disabled={busy}>
        {busy ? 'Ověřuji…' : 'Uplatnit kód'}
      </button>
    </form>
  );
}

export default function AccountPage() {
  const { configured, loading, user, displayName, memberships, membershipsError, refreshMemberships, signOut } = useAuth();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();

  if (!configured) return <NotConfigured />;
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/prihlaseni" replace />;

  const openStaff = async () => {
    await refreshMemberships();
    navigate('/knihovnik');
  };

  return (
    <main className="plain plain--center">
      <section className="plain-card">
        <h1>{displayName}</h1>
        <p className="plain-muted">{user.email}</p>

        {membershipsError && <p className="plain-error" role="alert">{membershipsError}</p>}

        {memberships.length > 0 ? (
          <>
            <h2>Moje knihovny</h2>
            <ul className="plain-list">
              {memberships.map((m) => (
                <li key={m.library_id}>
                  {m.libraries?.name} ({m.role === 'admin' ? 'správce' : 'zaměstnanec'})
                </li>
              ))}
            </ul>
            <Link className="plain-btn plain-btn--primary" to="/knihovnik">Do knihovnické části</Link>
          </>
        ) : (
          !membershipsError && (
            <div className="plain-columns">
              <CreateLibraryForm onDone={openStaff} />
              <RedeemInviteForm onDone={openStaff} />
            </div>
          )
        )}

        {error && <p className="plain-error" role="alert">{error}</p>}
        <div className="plain-actions">
          <Link className="plain-btn" to="/">Moje chata</Link>
          <Link className="plain-btn" to="/knihovny">Knihovny</Link>
          <button type="button" className="plain-btn" disabled={busy} onClick={() => run(signOut)}>
            Odhlásit se
          </button>
        </div>
      </section>
    </main>
  );
}
