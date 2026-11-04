import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { bookColor, isLightColor, plural } from '../services/genres';

function lastName(authors) {
  const first = String(authors || '').split(',')[0].trim();
  return first.split(' ').pop();
}

function ShelfBook({ book, index, total, onOpen }) {
  const pages = book.page_count || 300;
  const w = 26 + Math.round((Math.min(pages, 760) / 760) * 22);
  const h = 168 + (((book.title || '').length * 7 + index * 13) % 46);
  const color = bookColor(book);
  const tone = isLightColor(color) ? ' is-light' : '';
  const lean = index === total - 1 && total > 2 ? ' is-leaning' : '';
  const lent = book.loan ? ' is-lent' : '';

  return (
    <button
      type="button"
      className={`shelf-book${lean}${lent}`}
      style={{ '--w': `${w}px`, '--h': `${h}px`, '--d': `${Math.round(h * 0.68)}px`, '--i': index }}
      onClick={() => onOpen(book)}
      aria-label={`${book.title} — ${book.authors}${book.loan ? `, půjčeno: ${book.loan.borrower}` : ''}`}
    >
      <span className={`shelf-book__spine${tone}`} style={{ background: color }}>
        <span className="shelf-book__title">{book.title}</span>
        <span className="shelf-book__author">{lastName(book.authors)}</span>
      </span>
      <span className={`shelf-book__cover${tone}`} style={{ background: color }}>
        <i>{book.authors}</i>
        <span className="ornament" />
        <b>{book.title}</b>
      </span>
      {book.status === 'reading' && <span className="shelf-book__flag" />}
      {book.loan && <span className="shelf-book__loan" title={`Půjčeno: ${book.loan.borrower}`}>půjčeno</span>}
      {book.badge && <span className="shelf-book__loan">{book.badge}</span>}
    </button>
  );
}

/** Polička zblízka: dřevěná stěna, knihy ve 3D, mosazná cedulka. */
export default function ShelfSheet({ genre: openGenre, books: openBooks, onClose, onOpenBook, onRename }) {
  const open = Boolean(openGenre);
  // Při zavírání držíme poslední obsah, aby polička odjela i s knihami.
  const last = useRef({ genre: null, books: [] });
  if (open) last.current = { genre: openGenre, books: openBooks };
  const { genre, books } = last.current;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => setEditing(false), [openGenre]);
  const read = books.filter((b) => b.status === 'read').length;

  return (
    <section className={`shelf-sheet ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open}>
      {genre && (
        <>
          <header className="shelf-sheet__head">
            <div>
              <small className="eyebrow">Polička</small>
              {editing ? (
                <form
                  className="shelf-rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onRename(genre, draft);
                    setEditing(false);
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Nový název poličky"
                    autoFocus
                    autoComplete="off"
                  />
                  <button type="submit" className="round-btn" aria-label="Uložit název" disabled={!draft.trim()}>
                    <Check size={18} />
                  </button>
                  <button type="button" className="round-btn" aria-label="Zrušit" onClick={() => setEditing(false)}>
                    <X size={18} />
                  </button>
                </form>
              ) : (
                <h2>
                  {genre}
                  {onRename && (
                    <button
                      type="button"
                      className="shelf-rename__pencil"
                      aria-label="Přejmenovat poličku"
                      onClick={() => {
                        setDraft(genre);
                        setEditing(true);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </h2>
              )}
            </div>
            <p className="shelf-sheet__meta">
              {books.length} {plural(books.length, 'kniha', 'knihy', 'knih')}
              {onRename && ` · ${read} přečteno`}
            </p>
            <button type="button" className="round-btn" onClick={onClose} aria-label="Zavřít poličku">
              <X size={20} />
            </button>
          </header>
          <div className="shelf-sheet__shelf">
            {/* key restartuje vstupní animaci knih při změně poličky */}
            <div className="shelf-row" key={genre}>
              {books.map((book, i) => (
                <ShelfBook key={book.id} book={book} index={i} total={books.length} onOpen={onOpenBook} />
              ))}
            </div>
            <div className="shelf-board">
              <span className="shelf-plaque">{genre}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
