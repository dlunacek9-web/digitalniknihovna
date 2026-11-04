import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import PasswordForm from './PasswordForm';
import '../styles/plain.css';

/** Zobrazí se po návratu z odkazu pro obnovu hesla; uživatel je v tu chvíli už přihlášený. */
export default function NewPasswordPage() {
  const { finishPasswordRecovery } = useAuth();
  const [done, setDone] = useState(false);

  return (
    <main className="plain plain--center">
      <section className="plain-card plain-card--narrow">
        <h1>Nové heslo</h1>
        {done ? (
          <p className="plain-notice" role="status">Heslo je změněné.</p>
        ) : (
          <PasswordForm onDone={() => setDone(true)} />
        )}
        <button type="button" className={done ? 'plain-btn plain-btn--primary' : 'plain-link'} onClick={finishPasswordRecovery}>
          {done ? 'Pokračovat do aplikace' : 'Teď ne, heslo nechat být'}
        </button>
      </section>
    </main>
  );
}
