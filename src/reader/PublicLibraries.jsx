import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { ArrowLeft, ListChecks, Search, X } from 'lucide-react';
import LibraryCabin from '../components/LibraryCabin';
import ShelfSheet from '../components/ShelfSheet';
import SearchSheet from '../components/SearchSheet';
import ReaderNav from '../components/ReaderNav';
import ReturnLoanButton from '../components/ReturnLoanButton';
import { createLibraryStreetScene } from '../city/libraryStreetScene';
import { useAuth } from '../lib/AuthContext';
import { useAction, useAsync } from '../lib/useAsync';
import { itemToBook, matchesQuery } from '../lib/catalog';
import { BORROWED_SHELF } from '../lib/borrowedBooks';
import { ITEM_STATUS_LABELS, canRequestReturn, formatDate, isOverdue, loanStatusLabel, requestAvailability } from '../lib/loanRules';
import { genreOf, groupIntoShelves, plural } from '../services/genres';
import { getLibraries } from '../services/libraryStore';
import { cancelLoan, listCatalog, listLibraries, listMyLoans, requestLoan, requestReturn } from '../services/publicLibraryApi';
import { NotConfigured } from '../pages/PlainParts';

function Street({ libraries, onEnter }) {
  const canvasRef = useRef(null);
  const labelsRef = useRef(null);
  const sceneRef = useRef(null);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    const scene = createLibraryStreetScene({
      canvas: canvasRef.current,
      labelsEl: labelsRef.current,
      onLibraryClick: (id) => onEnterRef.current(id, scene)
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setLibraries(libraries);
  }, [libraries]);

  return (
    <div className="cabin">
      <div className="cabin-aurora" aria-hidden="true"><i /><i /><i /></div>
      <canvas ref={canvasRef} className="cabin-canvas" aria-label="3D ulice s knihovnami" />
      <div ref={labelsRef} className="cabin-labels" />
    </div>
  );
}

function BookCard({ item, library, myLoans, onClose, onRequested }) {
  const [note, setNote] = useState('');
  const [cabinId, setCabinId] = useState('');
  const [cabins] = useState(() => getLibraries().filter((lib) => !lib.demo));
  const { busy, error, run } = useAction();
  const { canRequest, reason } = requestAvailability(item, library, myLoans);
  const facts = [
    item.publisher && `Nakladatel: ${item.publisher}`,
    item.year && `Rok vydání: ${item.year}`,
    item.isbn && `ISBN: ${item.isbn}`,
    item.inventory_number && `Inventární číslo: ${item.inventory_number}`,
    `Stav: ${ITEM_STATUS_LABELS[item.status]}`
  ].filter(Boolean);

  return (
    <div className="pub-overlay" role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <article className="pub-card">
        <button type="button" className="round-btn" onClick={onClose} aria-label="Zavřít"><X size={18} /></button>
        <small className="eyebrow">{genreOf(item)}</small>
        <h3>{item.title}</h3>
        <div className="pub-card__book">
          {item.cover_url && <img src={item.cover_url} alt="" onError={(e) => e.currentTarget.remove()} />}
          <div className="pub-card__facts">
            <span>{item.authors || 'Neznámý autor'}</span>
            {facts.map((fact) => <span key={fact}>{fact}</span>)}
          </div>
        </div>
        {canRequest && cabins.length === 0 && (
          <p className="pub-message">
            Nemáš žádnou vlastní chatu, kam by se kniha přesunula. <Link to="/">Založ si ji v Moje chata</Link>.
          </p>
        )}
        {canRequest && cabins.length > 0 && (
          <form
            style={{ display: 'contents' }}
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() => requestLoan(item.id, note, cabinId));
              if (ok) onRequested(item);
              else onRequested(null);
            }}
          >
            <label>
              Do které chaty se kniha přesune
              <select value={cabinId} onChange={(e) => setCabinId(e.target.value)} required>
                <option value="" disabled>Vyber chatu…</option>
                {cabins.map((cabin) => (
                  <option key={cabin.id} value={cabin.id}>{cabin.name}</option>
                ))}
              </select>
              <small>Po schválení knihovníkem v ní vznikne polička {BORROWED_SHELF}.</small>
            </label>
            <label>
              Poznámka pro knihovníka (nepovinné)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </label>
            <button type="submit" className="dock-btn btn-ember" disabled={busy || !cabinId}>
              {busy ? 'Odesílám…' : 'Požádat o půjčení'}
            </button>
          </form>
        )}
        {!canRequest && <p className="pub-message">{reason}</p>}
        {error && <p className="pub-message is-error" role="alert">{error}</p>}
      </article>
    </div>
  );
}

function MyLoans({ loans, loading, error, onRetry, onClose, onChanged }) {
  const action = useAction();

  return (
    <div className="pub-overlay" role="dialog" aria-modal="true" aria-label="Moje žádosti a výpůjčky" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="pub-card">
        <button type="button" className="round-btn" onClick={onClose} aria-label="Zavřít"><X size={18} /></button>
        <h3>Moje žádosti a výpůjčky</h3>
        {loading && !loans && <p className="pub-message" role="status">Načítám…</p>}
        {error && (
          <>
            <p className="pub-message is-error" role="alert">{error}</p>
            <button type="button" className="pub-retry" onClick={onRetry}>Zkusit znovu</button>
          </>
        )}
        {action.error && <p className="pub-message is-error" role="alert">{action.error}</p>}
        {loans?.length === 0 && <p className="pub-message">Zatím žádné. O knihu požádáš v katalogu knihovny.</p>}
        {loans?.length > 0 && (
          <ul className="pub-loans">
            {loans.map((loan) => (
              <li key={loan.id}>
                <b>{loan.catalog_items?.title}</b>
                <small>{loan.catalog_items?.libraries?.name}</small>
                <small>
                  {loanStatusLabel(loan)} · požádáno {formatDate(loan.requested_at)}
                </small>
                {loan.status === 'picked_up' && (
                  <small className={isOverdue(loan) ? 'is-late' : ''}>
                    Vrátit do {formatDate(loan.due_at)}{isOverdue(loan) ? ' (po termínu)' : ''}
                  </small>
                )}
                {loan.status === 'returned' && <small>Vráceno {formatDate(loan.returned_at)}</small>}
                {loan.note && <small>Poznámka: {loan.note}</small>}
                {loan.status === 'requested' && (
                  <button
                    type="button"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await cancelLoan(loan.id);
                        await onChanged();
                      })
                    }
                  >
                    Zrušit žádost
                  </button>
                )}
                {canRequestReturn(loan) && (
                  <ReturnLoanButton
                    disabled={action.busy}
                    onConfirm={() =>
                      action.run(async () => {
                        await requestReturn(loan.id);
                        await onChanged();
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Interior({ library, myLoans, onReloadLoans, onBack, onOpenLoans }) {
  const { data, loading, error, reload } = useAsync(() => listCatalog(library.id), [library.id]);
  const [openGenre, setOpenGenre] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Vyřazené výtisky čtenář na policích nevidí.
  const books = useMemo(
    () => (data ?? []).filter((item) => item.status !== 'unavailable').map(itemToBook),
    [data]
  );
  const shelves = useMemo(() => groupIntoShelves(books), [books]);
  const shelfBooks = useMemo(() => shelves.find((s) => s.genre === openGenre)?.books ?? [], [shelves, openGenre]);
  const results = useMemo(
    () => (query.trim() ? books.filter((b) => matchesQuery([b.title, b.authors, b.isbn, b.publisher, genreOf(b)], query)) : []),
    [books, query]
  );
  const selected = books.find((b) => b.id === selectedId) || null;
  const closeShelf = useCallback(() => setOpenGenre(null), []);

  return (
    <>
      <LibraryCabin key={library.id} books={books} openGenre={openGenre} onShelfClick={setOpenGenre} hideCity variant="library" />

      {!openGenre && (
        <>
          <header className="cabin-header">
            <div className="cabin-brand">
              <h1>{library.name}</h1>
              <p>
                <b>{books.length} {plural(books.length, 'kniha', 'knihy', 'knih')}</b> ·{' '}
                <b>{library.loans_enabled ? 'půjčuje' : 'teď nepůjčuje'}</b>
              </p>
              <button type="button" className="chip-glass cabin-library-btn" onClick={onBack}>
                <ArrowLeft size={14} /> Zpět na ulici
              </button>
            </div>
            <div className="cabin-header__side">
              <ReaderNav />
            </div>
          </header>

          {loading && !data && <div className="cabin-empty"><h2>Načítám katalog…</h2></div>}
          {error && (
            <div className="cabin-empty" role="alert">
              <h2>Katalog se nepodařilo načíst</h2>
              <p>{error}</p>
              <button type="button" className="chip-glass" style={{ margin: '10px auto 0' }} onClick={reload}>Zkusit znovu</button>
            </div>
          )}
          {data && books.length === 0 && (
            <div className="cabin-empty">
              <h2>Katalog je zatím prázdný</h2>
              <p>Knihovna do něj ještě nepřidala žádné knihy.</p>
            </div>
          )}
          {books.length > 0 && <div className="cabin-hint">Táhni pro otočení · klikni na poličku</div>}

          <div className="cabin-dock">
            <button type="button" className="dock-btn dock-btn--ghost" onClick={() => setSearchOpen(true)} aria-label="Hledat v katalogu">
              <Search size={20} />
            </button>
            <button type="button" className="dock-btn btn-ember" onClick={onOpenLoans}>
              <ListChecks size={20} />
              Moje žádosti a výpůjčky
            </button>
          </div>
        </>
      )}

      <ShelfSheet genre={openGenre} books={shelfBooks} onClose={closeShelf} onOpenBook={(book) => setSelectedId(book.id)} />

      {searchOpen && (
        <SearchSheet
          query={query}
          onQueryChange={setQuery}
          results={results}
          onClose={() => setSearchOpen(false)}
          onOpenBook={(book) => {
            setSearchOpen(false);
            setOpenGenre(genreOf(book));
            setSelectedId(book.id);
          }}
        />
      )}

      {selected && (
        <BookCard
          key={selected.id}
          item={selected}
          library={library}
          myLoans={myLoans ?? []}
          onClose={() => setSelectedId(null)}
          onRequested={(item) => {
            // Po úspěchu i po chybě (výtisk mezitím zabral někdo jiný) se načte aktuální stav.
            reload();
            onReloadLoans();
            if (item) {
              setSelectedId(null);
              setToast(item.title);
            }
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <div className="toast__icon">📚</div>
          <div>
            <b>Žádost odeslána</b>
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
}

export default function PublicLibraries() {
  const { configured, loading: authLoading, user } = useAuth();
  const userId = user?.id;
  const librariesState = useAsync(() => (userId ? listLibraries() : Promise.resolve(null)), [userId]);
  const loansState = useAsync(() => (userId ? listMyLoans(userId) : Promise.resolve(null)), [userId]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [loansOpen, setLoansOpen] = useState(false);
  const entering = useRef(false);

  const libraries = librariesState.data;
  const allLibraries = useMemo(() => libraries ?? [], [libraries]);
  const filtered = useMemo(
    () => allLibraries.filter((l) => matchesQuery([l.name, l.city, l.address], query)),
    [allLibraries, query]
  );

  if (!configured) return <NotConfigured />;
  if (authLoading) return <div className="route-loading">Načítám…</div>;
  if (!user) return <Navigate to="/prihlaseni?next=/knihovny" replace />;

  const enter = async (id, scene) => {
    if (entering.current) return;
    entering.current = true;
    await scene?.enterLibrary(id);
    entering.current = false;
    setSelectedId(id);
  };

  const selected = allLibraries.find((l) => l.id === selectedId);

  return (
    <>
      {selected ? (
        <Interior
          library={selected}
          myLoans={loansState.data}
          onReloadLoans={loansState.reload}
          onBack={() => setSelectedId(null)}
          onOpenLoans={() => {
            loansState.reload();
            setLoansOpen(true);
          }}
        />
      ) : (
        <>
          <Street libraries={filtered} onEnter={enter} />
          <header className="cabin-header">
            <div className="cabin-brand">
              <h1>Knihovny</h1>
              <p>Vyber knihovnu a nahlédni do jejího katalogu</p>
            </div>
            <div className="cabin-header__side">
              <ReaderNav />
            </div>
          </header>

          <section className="street-panel" aria-label="Vyhledání knihovny">
            <h2>Najít knihovnu</h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Název nebo město…"
              aria-label="Hledat knihovnu"
            />
            {librariesState.loading && !libraries && <p className="pub-message" role="status">Načítám knihovny…</p>}
            {librariesState.error && (
              <>
                <p className="pub-message is-error" role="alert">{librariesState.error}</p>
                <button type="button" className="pub-retry" onClick={librariesState.reload}>Zkusit znovu</button>
              </>
            )}
            {libraries && filtered.length === 0 && (
              <p className="pub-message">{allLibraries.length ? 'Žádná knihovna neodpovídá hledání.' : 'Zatím tu není žádná knihovna.'}</p>
            )}
            <ul className="street-panel__list">
              {filtered.map((library) => (
                <li key={library.id}>
                  <button type="button" onClick={() => setSelectedId(library.id)}>
                    <b>{library.name}</b>
                    <small>{[library.address, library.city].filter(Boolean).join(', ') || (library.loans_enabled ? 'Půjčuje' : 'Teď nepůjčuje')}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            className="chip-glass pub-loans-btn"
            onClick={() => {
              loansState.reload();
              setLoansOpen(true);
            }}
          >
            <ListChecks size={16} />
            Moje žádosti a výpůjčky
          </button>
        </>
      )}

      {loansOpen && (
        <MyLoans
          loans={loansState.data}
          loading={loansState.loading}
          error={loansState.error}
          onRetry={loansState.reload}
          onClose={() => setLoansOpen(false)}
          onChanged={loansState.reload}
        />
      )}
    </>
  );
}
