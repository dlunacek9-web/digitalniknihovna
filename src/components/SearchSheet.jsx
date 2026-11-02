import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { bookColor, genreOf } from '../services/genres';

/** Vyhledávání v chatě — papírový list nahoře přes scénu. */
export default function SearchSheet({ query, onQueryChange, results, onClose, onOpenBook }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="search-sheet" role="dialog" aria-modal="true" aria-label="Hledat knihu" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-sheet__panel">
        <div className="search-sheet__field">
          <Search size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Název, autor, žánr, ISBN…"
            aria-label="Hledat"
          />
          <button type="button" className="round-btn" onClick={onClose} aria-label="Zavřít hledání">
            <X size={18} />
          </button>
        </div>

        {query.trim() && (
          <ul className="search-sheet__results">
            {results.length === 0 && <li className="search-sheet__empty">V chatě nic takového není.</li>}
            {results.map((book) => (
              <li key={book.id}>
                <button type="button" onClick={() => onOpenBook(book)}>
                  <span className="mini-spine" style={{ background: bookColor(book) }} />
                  <span>
                    <b>{book.title}</b>
                    <small>{book.authors}</small>
                  </span>
                  <em>{genreOf(book)}</em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
