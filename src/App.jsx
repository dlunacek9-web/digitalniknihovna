import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, ChevronDown, Search, X } from 'lucide-react';
import LibraryCabin from './components/LibraryCabin';
import ShelfSheet from './components/ShelfSheet';
import BookDetail from './components/BookDetail';
import SearchSheet from './components/SearchSheet';
import LibrarySheet from './components/LibrarySheet';
import ProfileView from './components/ProfileView';
import BookPreviewModal from './components/BookPreviewModal';
import ManualBookEntryModal from './components/ManualBookEntryModal';
import ReaderNav from './components/ReaderNav';
import { lookupByIsbn, toIsbn13 } from './services/knihovnyApi';
import {
  addBook,
  deleteBook,
  listBooks,
  getLibraries,
  addLibrary,
  renameLibrary,
  deleteLibrary,
  getActiveLibraryId,
  setActiveLibraryId,
  lendBook,
  returnBook,
  updateBook,
  moveBookToShelf,
  renameShelf,
  syncBorrowedBooks
} from './services/libraryStore';
import { genreOf, groupIntoShelves, plural } from './services/genres';
import { listMyLoans, requestReturn } from './services/publicLibraryApi';
import { BORROWED_SHELF } from './lib/borrowedBooks';
import { useAuth } from './lib/AuthContext';

// Skener (ZXing WASM) se načte až při prvním otevření.
const BookScanner = lazy(() => import('./components/BookScanner'));
const CityLibrary = lazy(() => import('./components/CityLibrary'));

export default function App() {
  const userId = useAuth().user?.id;
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'scan' | 'profile'

  // Každá knihovna je vlastní chata; zobrazuje se ta aktivní.
  const [libraries, setLibraries] = useState(() => getLibraries());
  const [activeLibraryId, setActiveLibraryIdState] = useState(() => getActiveLibraryId());
  const [targetScanLibraryId, setTargetScanLibraryId] = useState(
    () => getLibraries().find((lib) => !lib.demo)?.id || getActiveLibraryId() || ''
  );
  const [allBooks, setAllBooks] = useState(() => listBooks(null));

  const [openGenre, setOpenGenre] = useState(null);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [librariesOpen, setLibrariesOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityEntering, setCityEntering] = useState(false);
  const [cityAddedSignal, setCityAddedSignal] = useState(0);

  // Scanner & manual entry state
  const [scannedPreviewBook, setScannedPreviewBook] = useState(null);
  const [manualEntryIsbn, setManualEntryIsbn] = useState(null);
  const [isDuplicateAlert, setIsDuplicateAlert] = useState(false);
  const [notification, setNotification] = useState(null);
  const [keepScanning, setKeepScanning] = useState(() => {
    try {
      return localStorage.getItem('digitalniknihovna.keep_scanning.v1') === '1';
    } catch {
      return false;
    }
  });

  // GitHub Pages is static, so the personal library is persisted locally in this browser.
  const refresh = () => {
    try {
      setLibraries(getLibraries());
      setActiveLibraryIdState(getActiveLibraryId());
      setAllBooks(listBooks(null));
    } catch (err) {
      console.error('Error fetching books:', err);
      showNotification('Nepodařilo se načíst knihy', 'Úložiště prohlížeče neodpovídá.', 'error');
    }
  };

  const showNotification = (title, message = '', type = 'success', icon) => {
    setNotification({ title, message, type, icon: icon || (type === 'error' ? '❄' : '🪵'), key: Date.now() });
  };

  useEffect(() => {
    if (!notification) return undefined;
    const timer = setTimeout(() => setNotification(null), 3200);
    return () => clearTimeout(timer);
  }, [notification]);

  // Knihy z knihovny: chata se srovná s výpůjčkami při otevření a při návratu do aplikace.
  const syncLoans = useCallback(async () => {
    if (!userId) return;
    try {
      const { added, removed, changed } = syncBorrowedBooks(await listMyLoans(userId));
      if (!changed) return;
      refresh();
      if (added.length > 0) {
        const cabin = getLibraries().find((lib) => lib.id === added[0].library_id);
        showNotification(`Nová kniha · ${BORROWED_SHELF}`, `${added[0].title} je v chatě ${cabin?.name ?? ''}`, 'success', '📚');
      } else if (removed.length > 0) {
        showNotification('Knihovník převzal vrácenou knihu', removed[0].title, 'success', '📚');
      }
    } catch (err) {
      // Bez spojení zůstává poslední známý stav, další pokus přijde při návratu do aplikace.
      console.error('Error syncing loans:', err);
    }
    // refresh a showNotification používají jen settery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    syncLoans();
    const onVisible = () => document.visibilityState === 'visible' && syncLoans();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncLoans]);

  const handleRequestReturn = async (book) => {
    try {
      await requestReturn(book.library_loan.id);
      showNotification('Žádost o vrácení odeslána', 'Až knihu přineseš, knihovník potvrdí převzetí.', 'success', '📚');
    } catch (err) {
      showNotification('Vrácení se nepodařilo odeslat', err.message, 'error');
    }
    await syncLoans();
  };

  const books = useMemo(
    () => allBooks.filter((b) => (b.library_id || 'lib_default_1') === activeLibraryId),
    [allBooks, activeLibraryId]
  );
  const shelves = useMemo(() => groupIntoShelves(books), [books]);
  const openShelfBooks = useMemo(
    () => shelves.find((s) => s.genre === openGenre)?.books ?? [],
    [shelves, openGenre]
  );
  const selectedBook = allBooks.find((b) => b.id === selectedBookId) || null;
  const searchResults = useMemo(
    () => (searchQuery.trim() ? listBooks(activeLibraryId, searchQuery) : []),
    [searchQuery, activeLibraryId, allBooks]
  );
  const libraryCounts = useMemo(() => {
    const counts = {};
    for (const b of allBooks) {
      const id = b.library_id || 'lib_default_1';
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [allBooks]);
  const scanTargetId = targetScanLibraryId || activeLibraryId || '';
  const scanTargetGenres = useMemo(
    () => groupIntoShelves(allBooks.filter((b) => (b.library_id || 'lib_default_1') === scanTargetId)).map((s) => s.genre),
    [allBooks, scanTargetId]
  );
  const activeLibrary = libraries.find((l) => l.id === activeLibraryId);

  const closeShelf = useCallback(() => setOpenGenre(null), []);

  // Poslední vypůjčená kniha se může vrátit i s otevřenou poličkou.
  useEffect(() => {
    if (openGenre && !shelves.some((s) => s.genre === openGenre)) setOpenGenre(null);
  }, [openGenre, shelves]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedBookId) setSelectedBookId(null);
      else if (searchOpen) setSearchOpen(false);
      else if (librariesOpen) setLibrariesOpen(false);
      else if (openGenre) setOpenGenre(null);
      else if (activeTab === 'profile') setActiveTab('library');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBookId, searchOpen, librariesOpen, openGenre, activeTab]);

  // Library Handlers
  const switchLibrary = (libId) => {
    setActiveLibraryId(libId);
    setActiveLibraryIdState(libId);
    setTargetScanLibraryId(libId);
    setOpenGenre(null);
    setSearchQuery('');
  };

  const handleCreateLibrary = (name) => {
    const created = addLibrary(name);
    switchLibrary(created.id);
    refresh();
    setLibrariesOpen(false);
    showNotification(`Nová chata · ${created.name}`, 'Zatím prázdná, poličky přibudou s knihami.');
  };

  const handleRenameLibrary = (id, name) => {
    if (renameLibrary(id, name)) {
      refresh();
      showNotification('Knihovna přejmenována', name);
    } else {
      showNotification('Nepodařilo se přejmenovat knihovnu', '', 'error');
    }
  };

  const handleDeleteLibrary = (id) => {
    const lib = libraries.find((l) => l.id === id);
    deleteLibrary(id);
    setOpenGenre(null);
    refresh();
    setTargetScanLibraryId(getActiveLibraryId() || '');
    showNotification('Knihovna smazána', lib ? lib.name : '');
  };

  const handleSelectTargetScanLibrary = (libId) => {
    setTargetScanLibraryId(libId);
    setActiveLibraryId(libId);
  };

  // Delete book from library
  const handleDeleteBook = (id) => {
    try {
      const book = allBooks.find((b) => b.id === id);
      if (deleteBook(id)) {
        setSelectedBookId(null);
        const remainingOnShelf = openShelfBooks.filter((b) => b.id !== id).length;
        if (remainingOnShelf === 0) setOpenGenre(null);
        showNotification('Kniha odešla z chaty', book ? book.title : '');
        refresh();
      } else {
        showNotification('Kniha nebyla nalezena', '', 'error');
      }
    } catch (err) {
      showNotification('Nepodařilo se uložit změnu', 'Prohlížeč zápis nepovolil.', 'error');
    }
  };

  const handleKeepScanningChange = (value) => {
    setKeepScanning(value);
    try {
      localStorage.setItem('digitalniknihovna.keep_scanning.v1', value ? '1' : '0');
    } catch {
      // volba se jen nezapamatuje
    }
  };

  const handleMoveBook = (book, genre) => {
    const name = genre.trim();
    if (!name || name === genreOf(book)) return;
    if (!moveBookToShelf(book.id, name)) {
      showNotification('Knihu se nepodařilo přesunout', '', 'error');
      return;
    }
    if (openShelfBooks.filter((b) => b.id !== book.id).length === 0) setOpenGenre(name);
    refresh();
    showNotification(`Přesunuto na poličku ${name}`, book.title);
  };

  const handleRenameShelf = (oldGenre, newGenre) => {
    const name = newGenre.trim();
    if (!name || name === oldGenre) return;
    if (!renameShelf(activeLibraryId, oldGenre, name)) {
      showNotification('Poličku se nepodařilo přejmenovat', '', 'error');
      return;
    }
    setOpenGenre(name);
    refresh();
    showNotification('Polička přejmenována', name);
  };

  const handleStatusChange = (book, status) => {
    try {
      updateBook(book.id, { status });
      refresh();
    } catch (err) {
      showNotification('Nepodařilo se uložit změnu', 'Prohlížeč zápis nepovolil.', 'error');
    }
  };

  // Lend / return a book
  const handleLendBook = (id, borrower, lentAt) => {
    const updated = lendBook(id, borrower, lentAt);
    if (!updated) {
      showNotification('Knihu se nepodařilo půjčit', '', 'error');
      return;
    }
    refresh();
    showNotification(`Půjčeno: ${updated.loan.borrower}`, updated.title, 'success', '🤝');
  };

  const handleReturnBook = (id) => {
    const updated = returnBook(id);
    if (!updated) {
      showNotification('Knihu se nepodařilo vrátit', '', 'error');
      return;
    }
    refresh();
    showNotification('Kniha je zpátky doma', updated.title);
  };

  // Save book from preview
  const handleSaveBook = (bookData) => {
    try {
      const targetLibId = scanTargetId || getActiveLibraryId();
      const genre = genreOf(bookData);
      const isNewShelf = !scanTargetGenres.includes(genre);
      const result = addBook({ ...bookData, genre }, targetLibId);
      const savedLibId = result.book?.library_id || targetLibId;

      const stayInScanner = keepScanning && activeTab === 'scan';

      setScannedPreviewBook(null);
      setManualEntryIsbn(null);
      // Z městské knihovny se nikam neodchází, kniha jen odletí domů.
      if (!stayInScanner && !cityOpen) {
        setOpenGenre(null);
        setActiveTab('library');
        if (savedLibId) switchLibrary(savedLibId);
      }
      refresh();

      if (result.duplicate) {
        showNotification('Tuhle knihu už máš', `Stojí na poličce ${genre}`, 'error');
        return;
      }

      if (result.success) {
        if (cityOpen) setCityAddedSignal((n) => n + 1);
        showNotification(
          isNewShelf ? `Nová polička · ${genre}` : result.book.title,
          isNewShelf ? `Založena automaticky pro „${result.book.title}“` : `Přidáno na poličku ${genre}`
        );
      } else {
        showNotification('Při ukládání knihy došlo k chybě', '', 'error');
      }
    } catch (err) {
      showNotification('Prohlížeč nepovolil uložení knihy', '', 'error');
    }
  };

  // Handle scanned ISBN from BookScanner
  const handleIsbnDetected = async (isbn) => {
    try {
      const result = await lookupByIsbn(isbn);

      if (result.success && result.book) {
        const cleanSearchIsbn = toIsbn13(isbn);
        const alreadyInLibrary = listBooks(scanTargetId).some((b) => toIsbn13(b.isbn) === cleanSearchIsbn);

        setScannedPreviewBook({
          ...result.book,
          alreadyInLibrary
        });
        setIsDuplicateAlert(alreadyInLibrary);
        return;
      }

      showNotification('Kniha v katalogu není', result.error || 'Můžeš ji vložit ručně.', 'error');
      setManualEntryIsbn(isbn);
    } catch (err) {
      showNotification('Nepodařilo se vyhledat knihu', 'Můžeš ji vložit ručně.', 'error');
      setManualEntryIsbn(isbn);
    }
  };

  // Při změně cílové chaty v náhledu se znovu ověří duplicita.
  const handleTargetLibraryChange = (libId) => {
    setTargetScanLibraryId(libId);
    setScannedPreviewBook((book) => {
      if (!book) return book;
      const isbn = book.isbn ? toIsbn13(book.isbn) : '';
      const dup = Boolean(isbn) && listBooks(libId).some((b) => toIsbn13(b.isbn) === isbn);
      setIsDuplicateAlert(dup);
      return { ...book, alreadyInLibrary: dup };
    });
  };

  // Kniha z městské knihovny projde stejným náhledem jako naskenovaná.
  const handleCityAddBook = (book) => {
    const isbn = book.isbn ? toIsbn13(book.isbn) : '';
    const alreadyInLibrary = Boolean(isbn) && listBooks(scanTargetId).some((b) => toIsbn13(b.isbn) === isbn);
    setScannedPreviewBook({ ...book, alreadyInLibrary });
    setIsDuplicateAlert(alreadyInLibrary);
  };

  // Kamera vlétne do bubliny a o chvíli později se z jejího středu rozevře hala.
  const enterCity = () => {
    if (cityEntering) return;
    setCityEntering(true);
    setTimeout(() => setCityOpen(true), 650);
  };
  const leaveCity = () => {
    setCityOpen(false);
    setCityEntering(false);
  };

  const openBookAnywhere = (book) => {
    const libId = book.library_id || 'lib_default_1';
    if (libId !== activeLibraryId) switchLibrary(libId);
    setActiveTab('library');
    setOpenGenre(genreOf(book));
    setSelectedBookId(book.id);
  };

  const sheetOpen = Boolean(openGenre);

  return (
    <>
      {/* Chata zůstává vykreslená i pod skenerem, ať se po návratu nestaví znovu */}
      <LibraryCabin
        key={activeLibraryId || 'none'}
        books={books}
        openGenre={openGenre}
        onShelfClick={setOpenGenre}
        posterOpen={activeTab === 'profile'}
        onCityClick={() => activeTab === 'library' && !openGenre && enterCity()}
        onProfileClick={() => activeTab === 'library' && !openGenre && setActiveTab('profile')}
        cityEntering={cityEntering}
        onPosterClick={() => activeTab === 'library' && !openGenre && setActiveTab('profile')}
        posterContent={
          <>
            <button type="button" className="page-wood__back" onClick={() => setActiveTab('library')}>
              <ArrowLeft size={16} /> Zpět do chaty
            </button>
            <ProfileView
              books={allBooks}
              onDataImported={refresh}
              showNotification={(message, type) => showNotification(message, '', type)}
              onReturnBook={handleReturnBook}
              onOpenBook={openBookAnywhere}
            />
          </>
        }
      />

      {activeTab === 'library' && !cityEntering && (
        <>
          <header className="cabin-header">
            <div className="cabin-brand">
              <h1>Lukutupa</h1>
              <p>
                <b>{books.length} {plural(books.length, 'kniha', 'knihy', 'knih')}</b> ·{' '}
                <b>{shelves.length} {plural(shelves.length, 'polička', 'poličky', 'poliček')}</b>
              </p>
              <button type="button" className="chip-glass cabin-library-btn" onClick={() => setLibrariesOpen(true)}>
                {activeLibrary?.name || 'Knihovna'} <ChevronDown size={14} />
              </button>
            </div>
            <div className="cabin-header__side">
              <ReaderNav />
            </div>
          </header>

          {books.length === 0 && (
            <div className="cabin-empty">
              <h2>Chata je zatím prázdná</h2>
              <p>Naskenuj první knihu a truhlář přibije první poličku. Každý nový žánr dostane vlastní.</p>
            </div>
          )}

          {books.length > 0 && !sheetOpen && <div className="cabin-hint">Táhni pro otočení · klikni na poličku</div>}

          <div className={`cabin-dock ${sheetOpen ? 'is-hidden' : ''}`}>
            <button type="button" className="dock-btn dock-btn--ghost" onClick={() => setSearchOpen(true)} aria-label="Hledat">
              <Search size={20} />
            </button>
            <button type="button" className="dock-btn btn-ember" onClick={() => setActiveTab('scan')}>
              <Camera size={22} />
              Naskenovat knihu
            </button>
          </div>

          <ShelfSheet
            genre={openGenre}
            books={openShelfBooks}
            onClose={closeShelf}
            onOpenBook={(book) => setSelectedBookId(book.id)}
            onRename={handleRenameShelf}
          />
        </>
      )}

      {/* Unmounted while a result modal is open, so the camera restarts fresh for the next book */}
      {activeTab === 'scan' && (
        <div className="page-wood wood-wall fixed inset-0 z-10 overflow-y-auto">
          <button
            type="button"
            aria-label="Zavřít skener"
            onClick={() => {
              setActiveTab('library');
              refresh();
            }}
            className="fixed top-3 right-3 z-20 w-10 h-10 rounded-full bg-white/90 text-stone-700 shadow-md border border-stone-200 flex items-center justify-center hover:bg-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="page-wood__inner page-wood__inner--wide">
            {!scannedPreviewBook && !manualEntryIsbn && (
              <Suspense fallback={null}>
                <BookScanner
                  libraries={libraries}
                  selectedLibraryId={scanTargetId}
                  onSelectLibrary={handleSelectTargetScanLibrary}
                  keepScanning={keepScanning}
                  onKeepScanningChange={handleKeepScanningChange}
                  onIsbnDetected={handleIsbnDetected}
                  onClose={() => {
                    setActiveTab('library');
                    refresh();
                  }}
                />
              </Suspense>
            )}
          </div>
        </div>
      )}

      {cityOpen && (
        <Suspense fallback={null}>
          <CityLibrary
            onClose={leaveCity}
            onAddBook={handleCityAddBook}
            addedSignal={cityAddedSignal}
            modalOpen={Boolean(scannedPreviewBook)}
          />
        </Suspense>
      )}

      {librariesOpen && (
        <LibrarySheet
          libraries={libraries}
          counts={libraryCounts}
          activeId={activeLibraryId}
          onSelect={(id) => {
            switchLibrary(id);
            setLibrariesOpen(false);
          }}
          onCreate={handleCreateLibrary}
          onRename={handleRenameLibrary}
          onDelete={handleDeleteLibrary}
          onClose={() => setLibrariesOpen(false)}
        />
      )}

      {searchOpen && (
        <SearchSheet
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          onClose={() => setSearchOpen(false)}
          onOpenBook={(book) => {
            setSearchOpen(false);
            openBookAnywhere(book);
          }}
        />
      )}

      {selectedBook && (
        <BookDetail
          book={selectedBook}
          shelfCount={
            groupIntoShelves(allBooks.filter((b) => b.library_id === selectedBook.library_id)).find(
              (s) => s.genre === genreOf(selectedBook)
            )?.books.length ?? 1
          }
          onClose={() => setSelectedBookId(null)}
          shelfNames={shelves.map((s) => s.genre)}
          onMoveToShelf={handleMoveBook}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteBook}
          onLend={handleLendBook}
          onReturn={handleReturnBook}
          onRequestReturn={handleRequestReturn}
        />
      )}

      {/* Book Preview Modal (after scanning/lookup) */}
      {scannedPreviewBook && (
        <BookPreviewModal
          book={scannedPreviewBook}
          alreadyInLibrary={isDuplicateAlert}
          existingGenres={scanTargetGenres}
          libraries={libraries.filter((lib) => !lib.demo)}
          targetLibraryId={scanTargetId}
          onTargetChange={handleTargetLibraryChange}
          onConfirm={handleSaveBook}
          onCancel={() => setScannedPreviewBook(null)}
        />
      )}

      {/* Manual Book Entry Modal (if ISBN lookup fails or returns no book) */}
      {manualEntryIsbn && (
        <ManualBookEntryModal
          initialIsbn={manualEntryIsbn}
          onConfirm={handleSaveBook}
          onCancel={() => setManualEntryIsbn(null)}
        />
      )}

      {notification && (
        <div key={notification.key} className={`toast ${notification.type === 'error' ? 'is-error' : ''}`} role="status">
          <div className="toast__icon">{notification.icon}</div>
          <div>
            <b>{notification.title}</b>
            {notification.message && <span>{notification.message}</span>}
          </div>
        </div>
      )}
    </>
  );
}
