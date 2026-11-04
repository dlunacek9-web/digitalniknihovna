import React, { useMemo, useState } from 'react';
import { useStaffContext } from './StaffApp';
import { useAction, useAsync } from '../lib/useAsync';
import { EMPTY_CATALOG_FORM, formToRow, itemToForm, lookupToForm, matchesQuery } from '../lib/catalog';
import { ITEM_STATUS_LABELS } from '../lib/loanRules';
import { lookupByIsbn } from '../services/knihovnyApi';
import { addCatalogItem, listCatalog, setItemStatus, updateCatalogItem } from '../services/publicLibraryApi';
import { ConfirmButton, LoadState } from '../pages/PlainParts';

const FIELDS = [
  ['title', 'Název *'],
  ['authors', 'Autoři'],
  ['isbn', 'ISBN'],
  ['publisher', 'Nakladatel'],
  ['year', 'Rok vydání'],
  ['genre', 'Žánr'],
  ['inventory_number', 'Inventární číslo'],
  ['cover_url', 'Adresa obálky (https://)']
];

const TAG_CLASS = { available: 'is-ok', reserved: 'is-warn', on_loan: 'is-warn', unavailable: 'is-off' };

function ItemForm({ libraryId, editing, onSaved, onCancel }) {
  const [form, setForm] = useState(() => (editing ? itemToForm(editing) : EMPTY_CATALOG_FORM));
  const [isbn, setIsbn] = useState('');
  const [lookupNote, setLookupNote] = useState('');
  const lookup = useAction();
  const save = useAction();

  const findIsbn = () => {
    setLookupNote('');
    lookup.run(async () => {
      const result = await lookupByIsbn(isbn);
      if (!result.success) throw new Error(`${result.error} Údaje můžeš vyplnit ručně.`);
      setForm((current) => ({ ...lookupToForm(result.book), inventory_number: current.inventory_number }));
      setLookupNote('Údaje jsou předvyplněné, zkontroluj je a ulož.');
    });
  };

  const submit = (e) => {
    e.preventDefault();
    save.run(async () => {
      const row = formToRow(form);
      if (editing) await updateCatalogItem(editing.id, row);
      else await addCatalogItem(libraryId, row);
      onSaved();
    });
  };

  return (
    <section className="staff-panel">
      <h2>{editing ? 'Upravit výtisk' : 'Přidat výtisk'}</h2>
      {!editing && (
        <div className="staff-toolbar">
          <label className="plain-field">
            Vyhledat podle ISBN
            <input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978…" inputMode="numeric" />
          </label>
          <button type="button" className="plain-btn" disabled={lookup.busy || !isbn.trim()} onClick={findIsbn}>
            {lookup.busy ? 'Hledám…' : 'Vyhledat'}
          </button>
        </div>
      )}
      {lookup.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{lookup.error}</p>}
      {lookupNote && <p className="plain-notice" role="status" style={{ marginBottom: 12 }}>{lookupNote}</p>}
      <form className="plain-form" onSubmit={submit}>
        <div className="staff-form-grid">
          {FIELDS.map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key === 'title'}
              />
            </label>
          ))}
        </div>
        {save.error && <p className="plain-error" role="alert">{save.error}</p>}
        <div className="plain-actions">
          <button type="submit" className="plain-btn plain-btn--primary" disabled={save.busy}>
            {save.busy ? 'Ukládám…' : 'Uložit'}
          </button>
          <button type="button" className="plain-btn" onClick={onCancel}>Zrušit</button>
        </div>
      </form>
    </section>
  );
}

export default function Catalog() {
  const { library } = useStaffContext();
  const { data, loading, error, reload } = useAsync(() => listCatalog(library.id), [library.id]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formState, setFormState] = useState(null); // null | { editing: item | null }
  const action = useAction();

  const items = useMemo(
    () =>
      (data ?? []).filter(
        (item) =>
          (!statusFilter || item.status === statusFilter) &&
          matchesQuery([item.title, item.authors, item.isbn, item.inventory_number, item.genre, item.publisher], query)
      ),
    [data, query, statusFilter]
  );

  const changeStatus = (item, status) => {
    action.run(async () => {
      await setItemStatus(item.id, status);
      await reload();
    });
  };

  return (
    <>
      <header className="staff-head">
        <h1>Katalog</h1>
        <button type="button" className="plain-btn plain-btn--primary" onClick={() => setFormState({ editing: null })}>
          Přidat výtisk
        </button>
      </header>

      {formState && (
        <ItemForm
          key={formState.editing?.id || 'new'}
          libraryId={library.id}
          editing={formState.editing}
          onCancel={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            reload();
          }}
        />
      )}

      <div className="staff-toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledat název, autora, ISBN…"
          aria-label="Hledat v katalogu"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrovat podle stavu">
          <option value="">Všechny stavy</option>
          {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {action.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{action.error}</p>}

      <LoadState loading={loading} error={error} hasData={Boolean(data)} onRetry={reload}>
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Název</th>
                <th>ISBN</th>
                <th>Inv. číslo</th>
                <th>Žánr</th>
                <th>Stav</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title}
                    <small>{[item.authors, item.publisher, item.year].filter(Boolean).join(' · ')}</small>
                  </td>
                  <td>{item.isbn}</td>
                  <td>{item.inventory_number}</td>
                  <td>{item.genre}</td>
                  <td><span className={`staff-tag ${TAG_CLASS[item.status]}`}>{ITEM_STATUS_LABELS[item.status]}</span></td>
                  <td>
                    <div className="staff-row-actions">
                      <button type="button" className="plain-btn" onClick={() => setFormState({ editing: item })}>Upravit</button>
                      {item.status === 'available' && (
                        <ConfirmButton disabled={action.busy} onConfirm={() => changeStatus(item, 'unavailable')}>Vyřadit</ConfirmButton>
                      )}
                      {item.status === 'unavailable' && (
                        <button type="button" className="plain-btn" disabled={action.busy} onClick={() => changeStatus(item, 'available')}>
                          Vrátit do oběhu
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="staff-empty">{data?.length ? 'Hledání nic nenašlo.' : 'Katalog je prázdný. Přidej první výtisk.'}</p>
          )}
        </div>
      </LoadState>
    </>
  );
}
