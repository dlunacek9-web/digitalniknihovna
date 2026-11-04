import React, { useState } from 'react';
import { useAction } from '../lib/useAsync';
import { SEARCH_SCOPES, searchWorldBooks } from '../services/bookSearch';

const SCOPES = SEARCH_SCOPES.filter((scope) => scope.id !== 'isbn');

export default function BookSearchPanel({ initialQuery, onPick, onClose }) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState('all');
  const [result, setResult] = useState(null); // null | { books, failed }
  const search = useAction();

  const submit = (e) => {
    e.preventDefault();
    search.run(async () => {
      setResult(await searchWorldBooks({ query, scope }));
    });
  };

  const tooShort = query.trim().length < 2;

  return (
    <section className="staff-search" aria-label="Hledání v databázích knih">
      <form className="staff-toolbar" onSubmit={submit}>
        <label className="plain-field staff-search__query">
          Název nebo autor
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Například Babička nebo Němcová"
            autoFocus
          />
        </label>
        <label className="plain-field">
          Hledat v
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            {SCOPES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="plain-btn plain-btn--primary" disabled={search.busy || tooShort}>
          {search.busy ? 'Hledám…' : 'Hledat'}
        </button>
        <button type="button" className="plain-btn" onClick={onClose}>Zavřít hledání</button>
      </form>

      {search.error && <p className="plain-error" role="alert">{search.error}</p>}
      {result?.failed > 0 && (
        <p className="plain-warn" role="status">Některá databáze neodpověděla, výsledků může být méně.</p>
      )}
      {result && result.books.length === 0 && (
        <p className="plain-muted" role="status">Nic nenalezeno. Údaje můžeš vyplnit ručně.</p>
      )}

      {result?.books.length > 0 && (
        <ul className="staff-results">
          {result.books.map((book, index) => (
            <li key={`${book.isbn || book.title}-${index}`}>
              <div className="staff-results__cover">
                {book.cover_url?.startsWith('https://') && <img src={book.cover_url} alt="" loading="lazy" />}
              </div>
              <div className="staff-results__text">
                <b>{book.title}</b>
                <small>{[book.authors, book.publisher, book.publication_date].filter(Boolean).join(' · ')}</small>
                <small>{book.isbn ? `ISBN ${book.isbn}` : 'Bez ISBN'}{book.source ? ` · ${book.source}` : ''}</small>
              </div>
              <button type="button" className="plain-btn" onClick={() => onPick(book)}>Použít</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
