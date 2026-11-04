import React, { useState } from 'react';
import { useStaffContext } from './StaffApp';
import { useAction } from '../lib/useAsync';
import { updateLibrary } from '../services/publicLibraryApi';

export default function Settings() {
  const { library, refreshMemberships } = useStaffContext();
  const [form, setForm] = useState({
    name: library.name || '',
    address: library.address || '',
    city: library.city || '',
    loans_enabled: library.loans_enabled
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();

  const update = (changes) => {
    setSaved(false);
    setForm({ ...form, ...changes });
  };

  return (
    <>
      <header className="staff-head"><h1>Nastavení knihovny</h1></header>
      <section className="staff-panel" style={{ maxWidth: 560 }}>
        <form
          className="plain-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(async () => {
              await updateLibrary(library.id, {
                name: form.name.trim(),
                address: form.address.trim() || null,
                city: form.city.trim() || null,
                loans_enabled: form.loans_enabled
              });
              await refreshMemberships();
            });
            setSaved(ok);
          }}
        >
          <label>
            Název
            <input value={form.name} onChange={(e) => update({ name: e.target.value })} required maxLength={200} />
          </label>
          <label>
            Adresa
            <input value={form.address} onChange={(e) => update({ address: e.target.value })} maxLength={300} />
          </label>
          <label>
            Město
            <input value={form.city} onChange={(e) => update({ city: e.target.value })} maxLength={100} />
          </label>
          <label className="plain-check">
            <input type="checkbox" checked={form.loans_enabled} onChange={(e) => update({ loans_enabled: e.target.checked })} />
            Čtenáři mohou žádat o půjčení
          </label>
          <p className="plain-muted">Vypnutí zastaví jen nové žádosti. Už podané žádosti a výpůjčky běží dál.</p>
          {error && <p className="plain-error" role="alert">{error}</p>}
          {saved && <p className="plain-notice" role="status">Uloženo.</p>}
          <div className="plain-actions">
            <button type="submit" className="plain-btn plain-btn--primary" disabled={busy}>
              {busy ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
