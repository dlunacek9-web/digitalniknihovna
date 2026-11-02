import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, ChevronDown, Search, User } from 'lucide-react';
import LibraryCabin from './components/LibraryCabin';
import ShelfSheet from './components/ShelfSheet';
import BookDetail from './components/BookDetail';
import SearchSheet from './components/SearchSheet';
import LibrarySheet from './components/LibrarySheet';
import ProfileView from './components/ProfileView';
import BookPreviewModal from './components/BookPreviewModal';
import ManualBookEntryModal from './components/ManualBookEntryModal';
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
  updateBook
} from './services/libraryStore';
import { genreOf, groupIntoShelves, plural } from './services/genres';

// Skener (ZXing WASM) se načte až při prvním otevření.
const BookScanner = lazy(() => import('./components/BookScanner'));

export default function App() {
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'scan' | 'profile'

  // Každá knihovna je vlastní chata; zobrazuje se ta aktivní.
  const [libraries, setLibraries] = useState(() => getLibraries());
  const [activeLibraryId, setActiveLibraryIdState] = useState(() => getActiveLibraryId());
  const [targetScanLibraryId, setTargetScanLibraryId] = useState(() => getActiveLibraryId() || '');
  const [allBooks, setAllBooks] = useState(() => listBooks(null));

  const [openGenre, setOpenGenre] = useState(null);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [librariesOpen, setLibrariesOpen] = useState(false);

  // Scanner & manual entry state
  const [scannedPreviewBook, setScannedPreviewBook] = useState(null);
  const [manualEntryIsbn, setManualEntryIsbn] = useState(null);
  const [isDuplicateAlert, setIsDuplicateAlert] = useState(false);
  const [notification, setNotification] = useState(null);

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedBookId) setSelectedBookId(null);
      else if (searchOpen) setSearchOpen(false);
      else if (librariesOpen) setLibrariesOpen(false);
      else if (openGenre) setOpenGenre(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBookId, searchOpen, librariesOpen, openGenre]);

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

      setScannedPreviewBook(null);
      setManualEntryIsbn(null);
      setOpenGenre(null);
      setActiveTab('library');
      if (savedLibId) switchLibrary(savedLibId);
      refresh();

      if (result.duplicate) {
        showNotification('Tuhle knihu už máš', `Stojí na poličce ${genre}`, 'error');
        return;
      }

      if (result.success) {
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
      <LibraryCabin key={activeLibraryId || 'none'} books={books} openGenre={openGenre} onShelfClick={setOpenGenre} />

      {activeTab === 'library' && (
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
            <button type="button" className="chip-glass" onClick={() => setActiveTab('profile')} aria-label="Profil">
              <User size={16} />
              <span>Profil</span>
            </button>
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
          />
        </>
      )}

      {/* Unmounted while a result modal is open, so the camera restarts fresh for the next book */}
      {activeTab === 'scan' && (
        <div className="page-wood wood-wall fixed inset-0 z-10 overflow-y-auto">
          <div className="page-wood__inner page-wood__inner--wide">
            {!scannedPreviewBook && !manualEntryIsbn && (
              <Suspense fallback={null}>
                <BookScanner
                  libraries={libraries}
                  selectedLibraryId={scanTargetId}
                  onSelectLibrary={handleSelectTargetScanLibrary}
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

      {activeTab === 'profile' && (
        <div className="page-wood wood-wall fixed inset-0 z-10 overflow-y-auto">
          <div className="page-wood__inner page-wood__inner--wide">
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
          </div>
        </div>
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
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteBook}
          onLend={handleLendBook}
          onReturn={handleReturnBook}
        />
      )}

      {/* Book Preview Modal (after scanning/lookup) */}
      {scannedPreviewBook && (
        <BookPreviewModal
          book={scannedPreviewBook}
          alreadyInLibrary={isDuplicateAlert}
          existingGenres={scanTargetGenres}
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
