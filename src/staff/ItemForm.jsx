import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Search } from 'lucide-react';
import { applyBookToForm, EMPTY_CATALOG_FORM, findSimilarItems, formToRow, itemToForm } from '../lib/catalog';
import { isbnProblem } from '../lib/isbn';
import { useAction } from '../lib/useAsync';
import { lookupByIsbn } from '../services/knihovnyApi';
import { addCatalogItem, updateCatalogItem } from '../services/publicLibraryApi';
import BookSearchPanel from './BookSearchPanel';

// Kamera a čtení textu se načtou až při otevření skeneru.
const IsbnScanner = lazy(() => import('./IsbnScanner'));

const FIELDS = [
  ['title', 'Název *'],
  ['authors', 'Autoři'],
  ['publisher', 'Nakladatel'],
  ['year', 'Rok vydání'],
  ['genre', 'Žánr'],
  ['inventory_number', 'Inventární číslo'],
  ['cover_url', 'Adresa obálky (https://)']
];

const FILLED_NOTE = 'Údaje jsou předvyplněné, zkontroluj je a ulož.';

const describeItem = (item) =>
  [item.title, item.publisher, item.year, item.isbn && `ISBN ${item.isbn}`, item.inventory_number && `inv. ${item.inventory_number}`]
    .filter(Boolean)
    .join(' · ');

function SimilarItems({ similar, onEdit }) {
  if (!similar.copies.length && !similar.editions.length) return null;
  return (
    <div className="plain-warn staff-similar" role="status">
      {similar.copies.length > 0 && (
        <>
          <b>Toto vydání už v katalogu je. Uložením přidáš další výtisk.</b>
          <ul>
            {similar.copies.map((item) => (
              <li key={item.id}>
                {describeItem(item)}{' '}
                <button type="button" className="plain-link" onClick={() => onEdit(item)}>Upravit tento výtisk</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {similar.editions.length > 0 && (
        <>
          <b>V katalogu je možná jiné vydání stejné knihy.</b>
          <ul>
            {similar.editions.map((item) => (
              <li key={item.id}>
                {describeItem(item)}{' '}
                <button type="button" className="plain-link" onClick={() => onEdit(item)}>Upravit tento výtisk</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function ItemForm({ libraryId, editing, preset, heading, items, onSaved, onCancel, onEdit }) {
  const [form, setForm] = useState(() => (editing ? itemToForm(editing) : preset || EMPTY_CATALOG_FORM));
  const [noIsbn, setNoIsbn] = useState(Boolean(editing && !editing.isbn));
  const [tool, setTool] = useState(null); // null | 'scanner' | 'search'
  const [note, setNote] = useState('');
  const lookup = useAction();
  const save = useAction();
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const similar = useMemo(() => findSimilarItems(form, items, editing?.id), [form, items, editing?.id]);
  const isbnWarning = noIsbn ? '' : isbnProblem(form.isbn);

  const fillByIsbn = (isbn) => {
    setNote('');
    setNoIsbn(false);
    setForm((current) => ({ ...current, isbn }));
    lookup.run(async () => {
      const result = await lookupByIsbn(isbn);
      if (!result.success) throw new Error(`${result.error} Údaje můžeš vyplnit ručně.`);
      setForm((current) => applyBookToForm(current, result.book));
      setNote(FILLED_NOTE);
    });
  };

  const pickBook = (book) => {
    lookup.clearError();
    setForm((current) => applyBookToForm(current, book));
    if (book.isbn) setNoIsbn(false);
    setNote(FILLED_NOTE);
    setTool(null);
  };

  const toggleNoIsbn = (checked) => {
    setNoIsbn(checked);
    if (checked) {
      lookup.clearError();
      setForm((current) => ({ ...current, isbn: '' }));
    }
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

  const saveLabel = editing
    ? 'Uložit'
    : similar.copies.length
      ? 'Přidat další výtisk'
      : similar.editions.length
        ? 'Přidat jako jiné vydání'
        : 'Uložit';

  return (
    <section className="staff-panel" ref={panelRef}>
      <h2>{heading}</h2>

      <div className="plain-actions staff-intake">
        <button
          type="button"
          className={`plain-btn ${tool === 'scanner' ? 'plain-btn--primary' : ''}`}
          aria-pressed={tool === 'scanner'}
          onClick={() => setTool(tool === 'scanner' ? null : 'scanner')}
        >
          <ScanLine size={15} /> Skenovat ISBN
        </button>
        <button
          type="button"
          className={`plain-btn ${tool === 'search' ? 'plain-btn--primary' : ''}`}
          aria-pressed={tool === 'search'}
          onClick={() => setTool(tool === 'search' ? null : 'search')}
        >
          <Search size={15} /> Hledat podle názvu nebo autora
        </button>
      </div>

      {tool === 'scanner' && (
        <Suspense fallback={<p role="status">Načítám skener…</p>}>
          <IsbnScanner
            onClose={() => setTool(null)}
            onCode={(code) => {
              setTool(null);
              fillByIsbn(code);
            }}
          />
        </Suspense>
      )}
      {tool === 'search' && (
        <BookSearchPanel
          initialQuery={form.title || form.authors}
          onPick={pickBook}
          onClose={() => setTool(null)}
        />
      )}

      {lookup.busy && <p className="plain-muted" role="status" style={{ marginBottom: 12 }}>Hledám knihu podle ISBN…</p>}
      {lookup.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{lookup.error}</p>}
      {note && <p className="plain-notice" role="status" style={{ marginBottom: 12 }}>{note}</p>}

      <form className="plain-form" onSubmit={submit}>
        <div className="staff-isbn">
          <label className="plain-field">
            ISBN
            <input
              value={form.isbn}
              disabled={noIsbn}
              inputMode="text"
              placeholder={noIsbn ? 'Kniha nemá ISBN' : '978…'}
              onChange={(e) => setForm({ ...form, isbn: e.target.value })}
              onKeyDown={(e) => {
                // Enter v poli ISBN knihu vyhledá, formulář se ještě neukládá.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (form.isbn.trim() && !lookup.busy) fillByIsbn(form.isbn);
                }
              }}
            />
          </label>
          <button
            type="button"
            className="plain-btn"
            disabled={noIsbn || lookup.busy || !form.isbn.trim()}
            onClick={() => fillByIsbn(form.isbn)}
          >
            {lookup.busy ? 'Hledám…' : 'Doplnit podle ISBN'}
          </button>
          <label className="plain-check">
            <input type="checkbox" checked={noIsbn} onChange={(e) => toggleNoIsbn(e.target.checked)} />
            Kniha nemá ISBN
          </label>
        </div>
        {isbnWarning && <p className="plain-warn" role="status">{isbnWarning}</p>}

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

        <SimilarItems similar={similar} onEdit={onEdit} />

        {save.error && <p className="plain-error" role="alert">{save.error}</p>}
        <div className="plain-actions">
          <button type="submit" className="plain-btn plain-btn--primary" disabled={save.busy}>
            {save.busy ? 'Ukládám…' : saveLabel}
          </button>
          <button type="button" className="plain-btn" onClick={onCancel}>Zrušit</button>
        </div>
      </form>
    </section>
  );
}
