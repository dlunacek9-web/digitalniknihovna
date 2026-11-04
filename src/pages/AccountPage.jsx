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

const MIN_PASSWORD = 8;

function ProfileForm() {
  const { user, displayName, updateName, updateEmail } = useAuth();
  const [name, setName] = useState(user.user_metadata?.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [message, setMessage] = useState('');
  const { busy, error, run } = useAction();

  return (
    <form
      className="plain-form"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage('');
        run(async () => {
          const notes = [];
          if (name.trim() !== (user.user_metadata?.name || '')) {
            await updateName(name);
            notes.push('Jméno je uloženo.');
          }
          if (email.trim() && email.trim() !== user.email) {
            await updateEmail(email);
            notes.push('Na nový email jsme poslali potvrzovací odkaz. Do potvrzení platí starý.');
          }
          setMessage(notes.join(' ') || `Beze změny (${displayName}).`);
        });
      }}
    >
      <h2>Moje údaje</h2>
      <label>
        Jméno
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      {error && <p className="plain-error" role="alert">{error}</p>}
      {message && <p className="plain-muted" role="status">{message}</p>}
      <button type="submit" className="plain-btn plain-btn--primary" disabled={busy}>
        {busy ? 'Ukládám…' : 'Uložit údaje'}
      </button>
    </form>
  );
}

function PasswordForm() {
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

function DeleteAccount() {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const { busy, error, run } = useAction();
  const matches = confirm.trim().toLowerCase() === (user.email || '').toLowerCase();

  if (!open) {
    return (
      <div className="plain-form">
        <h2>Smazat účet</h2>
        <p className="plain-muted">Účet i historie tvých výpůjček se nadobro smažou. Chaty v tomto prohlížeči zůstanou.</p>
        <button type="button" className="plain-btn plain-btn--danger" onClick={() => setOpen(true)}>
          Smazat účet…
        </button>
      </div>
    );
  }

  return (
    <form
      className="plain-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await deleteAccount();
          navigate('/', { replace: true });
        });
      }}
    >
      <h2>Smazat účet nadobro</h2>
      <p className="plain-muted">Tohle nejde vrátit. Pro potvrzení napiš svůj email ({user.email}).</p>
      <label>
        Email
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </label>
      {error && <p className="plain-error" role="alert">{error}</p>}
      <div className="plain-actions">
        <button type="button" className="plain-btn" disabled={busy} onClick={() => { setOpen(false); setConfirm(''); }}>
          Zrušit
        </button>
        <button type="submit" className="plain-btn plain-btn--danger" disabled={busy || !matches}>
          {busy ? 'Mažu…' : 'Smazat účet nadobro'}
        </button>
      </div>
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

        <ProfileForm />
        <PasswordForm />
        <DeleteAccount />

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
