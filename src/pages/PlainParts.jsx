import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';

export function NotConfigured() {
  return (
    <main className="plain plain--center">
      <section className="plain-card plain-card--narrow">
        <h1>Knihovny nejsou nastavené</h1>
        <p>Aplikace zatím není připojená k databázi. Domácí chata funguje dál.</p>
        <Link className="plain-link" to="/">Zpět do chaty</Link>
      </section>
    </main>
  );
}

export function PageLoading() {
  return (
    <main className="plain plain--center">
      <p role="status">Načítám…</p>
    </main>
  );
}

/** Stav načítání a chyby seznamu. Během obnovy nechává viditelná stará data. */
export function LoadState({ loading, error, hasData, onRetry, children }) {
  if (error) {
    return (
      <div className="plain-error" role="alert">
        <p>{error}</p>
        <button type="button" className="plain-btn" onClick={onRetry}>Zkusit znovu</button>
      </div>
    );
  }
  if (loading && !hasData) return <p role="status">Načítám…</p>;
  return children;
}

/** Tlačítko pro nevratnější akci: první klik se ptá, druhý ji provede. */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Opravdu?', disabled }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className={`plain-btn ${armed ? 'plain-btn--danger' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
