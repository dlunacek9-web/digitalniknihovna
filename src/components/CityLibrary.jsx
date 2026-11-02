import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookPlus, Search, X } from 'lucide-react';
import { createCityScene } from '../city/cityScene';
import { SEARCH_LANGS, SEARCH_SCOPES, searchWorldBooks } from '../services/bookSearch';
import { FEATURED_BOOKS } from '../services/featuredBooks';
import { bookColor, isLightColor } from '../services/genres';

function BookList({ books, onPick }) {
  return (
    <ul className="tome__results">
      {books.map((book, i) => {
        const color = bookColor(book);
        return (
          <li key={`${book.isbn || book.title}-${i}`}>
            <button type="button" onClick={() => onPick(book)}>
              <span className="tome__spine" style={{ background: color, color: isLightColor(color) ? '#2A2420' : '#fff' }}>
                {book.cover_url && <img src={book.cover_url} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />}
              </span>
              <span className="tome__meta">
                <b>{book.title}</b>
                <small>{[book.authors, book.publication_date].filter(Boolean).join(' · ')}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Městská knihovna: tajemná hala, kde se hledá v celosvětové databázi.
 * Vybraná kniha přiletí z regálů na pultík; odtud ji lze přidat do chaty.
 *
 * phase: 'search' (otevřená kniha s hledáním) → 'flying' → 'lectern' → 'leaving' → 'search'
 */
export default function CityLibrary({ onClose, onAddBook, addedSignal, modalOpen, onProgress }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const sceneRef = useRef(null);
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [lang, setLang] = useState('any');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('intro'); // intro: kamera se snáší chodbou
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    onProgress?.({ phase, queryLen: query.trim().length });
  }, [phase, query, onProgress]);

  useEffect(() => {
    const scene = createCityScene({
      canvas: canvasRef.current,
      onIntroDone: () => setPhase('search'),
      onLook: (dx, dy) => {
        if (stageRef.current) stageRef.current.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      }
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Hledání s malou prodlevou; starší odpovědi se zahodí.
  const requestId = useRef(0);
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      requestId.current++;
      setResults([]);
      setStatus('idle');
      return undefined;
    }
    setStatus('loading');
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { books, failed } = await searchWorldBooks({ query: text, scope, lang });
        if (id !== requestId.current) return;
        setResults(books);
        setStatus(books.length === 0 && failed > 0 ? 'error' : 'done');
      } catch {
        if (id === requestId.current) setStatus('error');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query, scope, lang]);

  const browsing = query.trim().length < 2;

  useEffect(() => {
    if (phase === 'search') inputRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const summon = (book) => {
    if (phase !== 'search') return;
    setSelected(book);
    setPhase('flying');
    sceneRef.current?.summonBook(book).then(() => setPhase('lectern'));
  };

  const sendBack = useCallback(() => {
    if (phase !== 'lectern') return;
    setPhase('leaving');
    sceneRef.current?.dismissBook('library').then(() => {
      setSelected(null);
      setPhase('search');
    });
  }, [phase]);

  // Po uložení knihy do chaty odletí domů a vyhledávání se vrátí.
  const lastSignal = useRef(addedSignal);
  useEffect(() => {
    if (addedSignal === lastSignal.current) return;
    lastSignal.current = addedSignal;
    if (phase !== 'lectern') return;
    setPhase('leaving');
    sceneRef.current?.dismissBook('home').then(() => {
      setSelected(null);
      setPhase('search');
    });
  }, [addedSignal, phase]);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 700);
  }, [closing, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || modalOpen) return;
      if (phase === 'lectern') sendBack();
      else if (phase === 'search') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, modalOpen, sendBack, requestClose]);

  const showTome = phase === 'search';
  const facts = selected
    ? [
        selected.publication_date && ['Rok', selected.publication_date],
        selected.page_count && ['Stran', selected.page_count],
        selected.publisher && ['Vydavatel', selected.publisher]
      ].filter(Boolean)
    : [];

  return (
    <div className={`city ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="Městská knihovna">
      <canvas ref={canvasRef} className="city-canvas" aria-hidden="true" />
      <div className="city-vignette" aria-hidden="true" />

      <header className={`city-top ${phase === 'intro' ? 'is-hidden' : ''}`}>
        <button type="button" className="chip-glass" onClick={requestClose} disabled={phase !== 'search' && phase !== 'lectern'}>
          <ArrowLeft size={16} />
          <span>Zpět do chaty</span>
        </button>
        <h2 className="city-title">Městská knihovna</h2>
      </header>

      <div ref={stageRef} className="city-stage">
        <section className={`tome ${showTome ? '' : 'is-down'}`} aria-label="Hledání knih" aria-hidden={!showTome}>
          <div className="tome__page tome__page--left">
            <small className="tome__eyebrow">Katalog všech knih světa</small>
            <h3>Co hledáš?</h3>
            <label className="tome__field">
              <Search size={18} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Název, autor, ISBN…"
                aria-label="Hledat v městské knihovně"
                disabled={!showTome}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Smazat hledání">
                  <X size={16} />
                </button>
              )}
            </label>

            <div className="tome__filter" role="group" aria-label="Hledat v">
              <span>Hledat v</span>
              {SEARCH_SCOPES.map((s) => (
                <button key={s.id} type="button" className={scope === s.id ? 'is-on' : ''} onClick={() => setScope(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="tome__filter" role="group" aria-label="Jazyk">
              <span>Jazyk</span>
              {SEARCH_LANGS.map((l) => (
                <button key={l.id} type="button" className={lang === l.id ? 'is-on' : ''} onClick={() => setLang(l.id)}>
                  {l.id === 'any' ? 'Všechny' : l.label}
                </button>
              ))}
            </div>
            <p className="tome__note">Knihovny.cz · Google Books · Open Library</p>
          </div>

          <div className="tome__page tome__page--right">
            {browsing && <BookList books={FEATURED_BOOKS} onPick={summon} />}
            {!browsing && status === 'loading' && <p className="tome__empty">Listuji v regálech…</p>}
            {!browsing && status === 'error' && <p className="tome__empty">Katalogy neodpovídají. Zkus to za chvíli.</p>}
            {!browsing && status === 'done' && results.length === 0 && <p className="tome__empty">Nic takového tu nestojí.</p>}
            {!browsing && status === 'done' && results.length > 0 && <BookList books={results} onPick={summon} />}
          </div>
        </section>

        {selected && phase === 'lectern' && (
          <aside className="city-card" aria-label="Vybraná kniha">
            <button type="button" className="round-btn city-card__close" onClick={sendBack} aria-label="Vrátit knihu do knihovny">
              <X size={18} />
            </button>
            <small className="eyebrow">Z regálů městské knihovny</small>
            <h3>{selected.title}</h3>
            <p className="city-card__by">{selected.authors || 'Neznámý autor'}</p>
            {facts.length > 0 && (
              <dl className="city-card__facts">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <button type="button" className="dock-btn btn-ember city-card__add" onClick={() => onAddBook(selected)}>
              <BookPlus size={20} />
              Přidat do knihovny
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
