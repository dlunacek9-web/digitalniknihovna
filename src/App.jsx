import React, { useState, useEffect } from 'react';
import BottomNavigation from './components/BottomNavigation';
import BookCard from './components/BookCard';
import BookDetailModal from './components/BookDetailModal';
import SearchBar from './components/SearchBar';
import EmptyState from './components/EmptyState';
import LoadingSkeleton from './components/LoadingSkeleton';
import ProfileView from './components/ProfileView';
import BookScanner from './components/BookScanner';
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
  setActiveLibraryId
} from './services/libraryStore';
import {
  BookMarked,
  FolderPlus,
  Folder,
  ArrowLeft,
  Trash2,
  Edit2,
  Plus,
  ChevronRight,
  Library,
  BookOpen
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'scan' | 'profile'

  // Libraries state
  const [libraries, setLibraries] = useState([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState(null); // null = overview of all libraries
  const [targetScanLibraryId, setTargetScanLibraryId] = useState('');

  // Books state in active library
  const [books, setBooks] = useState([]);
  const [allBooksCount, setAllBooksCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);

  // Library modal / dialog states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [editingLibrary, setEditingLibrary] = useState(null); // { id, name }
  const [editLibraryName, setEditLibraryName] = useState('');

  // Scanner & manual entry state
  const [scannedPreviewBook, setScannedPreviewBook] = useState(null);
  const [manualEntryIsbn, setManualEntryIsbn] = useState(null);
  const [isDuplicateAlert, setIsDuplicateAlert] = useState(false);
  const [notification, setNotification] = useState(null);

  // Load libraries on init
  const refreshLibraries = () => {
    const libs = getLibraries();
    setLibraries(libs);

    const activeId = getActiveLibraryId();
    if (activeId && libs.some((l) => l.id === activeId)) {
      setTargetScanLibraryId(activeId);
    } else if (libs.length > 0) {
      setTargetScanLibraryId(libs[0].id);
    }

    // Calculate total count of all books across all libraries for app header / stats
    const totalCount = listBooks(null).length;
    setAllBooksCount(totalCount);
  };

  const fetchBooksForLibrary = (libId, query = '') => {
    setLoading(true);
    try {
      if (libId) {
        setBooks(listBooks(libId, query));
      } else {
        setBooks([]);
      }
    } catch (err) {
      console.error('Error fetching books:', err);
      showNotification('Nepodařilo se načíst knihy z úložiště.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLibraries();
  }, []);

  useEffect(() => {
    if (selectedLibraryId) {
      fetchBooksForLibrary(selectedLibraryId, searchQuery);
    }
  }, [selectedLibraryId, searchQuery]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // Library Handlers
  const handleCreateLibrary = (e) => {
    e.preventDefault();
    if (!newLibraryName.trim()) return;

    const created = addLibrary(newLibraryName.trim());
    setNewLibraryName('');
    setIsCreateModalOpen(false);
    refreshLibraries();
    setSelectedLibraryId(created.id);
    setTargetScanLibraryId(created.id);
    showNotification(`Knihovna „${created.name}“ byla vytvořena.`);
  };

  const handleRenameLibrary = (e) => {
    e.preventDefault();
    if (!editingLibrary || !editLibraryName.trim()) return;

    if (renameLibrary(editingLibrary.id, editLibraryName.trim())) {
      showNotification('Knihovna byla přejmenována.');
      refreshLibraries();
    } else {
      showNotification('Nepodařilo se přejmenovat knihovnu.', 'error');
    }
    setEditingLibrary(null);
    setEditLibraryName('');
  };

  const handleDeleteLibrary = (libId, libName, e) => {
    if (e) e.stopPropagation();

    if (confirm(`Opravdu chceš smazat knihovnu „${libName}“ a všechny knihy v ní?`)) {
      deleteLibrary(libId);
      showNotification(`Knihovna „${libName}“ byla smazána.`);
      refreshLibraries();
      if (selectedLibraryId === libId) {
        setSelectedLibraryId(null);
      }
    }
  };

  const handleSelectLibraryToOpen = (libId) => {
    setSelectedLibraryId(libId);
    setActiveLibraryId(libId);
    setTargetScanLibraryId(libId);
    setSearchQuery('');
  };

  const handleSelectTargetScanLibrary = (libId) => {
    setTargetScanLibraryId(libId);
    setActiveLibraryId(libId);
  };

  // Delete book from library
  const handleDeleteBook = (id) => {
    try {
      if (deleteBook(id)) {
        showNotification('Kniha byla úspěšně odstraněna.');
        setSelectedBook(null);
        if (selectedLibraryId) {
          fetchBooksForLibrary(selectedLibraryId, searchQuery);
        }
        refreshLibraries();
      } else {
        showNotification('Kniha k odstranění nebyla nalezena.', 'error');
      }
    } catch (err) {
      showNotification('Nepodařilo se uložit změnu v prohlížeči.', 'error');
    }
  };

  // Save book from preview
  const handleSaveBook = (bookData) => {
    try {
      const targetLibId = targetScanLibraryId || selectedLibraryId || getActiveLibraryId();
      const result = addBook(bookData, targetLibId);

      if (result.duplicate) {
        showNotification('Tuto knihu už v této knihovně máš.', 'error');
        setScannedPreviewBook(null);
        if (targetLibId) {
          setSelectedLibraryId(targetLibId);
        }
        setActiveTab('library');
        return;
      }

      if (result.success) {
        showNotification('Kniha byla úspěšně přidána do knihovny!');
        setScannedPreviewBook(null);
        setManualEntryIsbn(null);
        if (targetLibId) {
          setSelectedLibraryId(targetLibId);
        }
        setActiveTab('library');
        refreshLibraries();
        if (targetLibId) {
          fetchBooksForLibrary(targetLibId);
        }
      } else {
        showNotification('Při ukládání knihy došlo k chybě.', 'error');
      }
    } catch (err) {
      showNotification('Prohlížeč nepovolil uložení knihy.', 'error');
    }
  };

  // Handle scanned ISBN from BookScanner
  const handleIsbnDetected = async (isbn) => {
    try {
      const result = await lookupByIsbn(isbn);

      if (result.success && result.book) {
        const targetLibId = targetScanLibraryId || selectedLibraryId || getActiveLibraryId();
        const existingBooksInTarget = listBooks(targetLibId);
        const cleanSearchIsbn = toIsbn13(isbn);
        const alreadyInLibrary = existingBooksInTarget.some(
          (b) => toIsbn13(b.isbn) === cleanSearchIsbn
        );

        setScannedPreviewBook({
          ...result.book,
          alreadyInLibrary
        });
        setIsDuplicateAlert(alreadyInLibrary);
        return;
      }

      showNotification(
        result.error || 'Knihu se nepodařilo v katalogu najít. Můžete ji vložit ručně.',
        'error'
      );
      setManualEntryIsbn(isbn);
    } catch (err) {
      showNotification('Nepodařilo se vyhledat informace o knize. Můžete ji vložit ručně.', 'error');
      setManualEntryIsbn(isbn);
    }
  };

  const currentLibraryObject = libraries.find((l) => l.id === selectedLibraryId);
  const totalPagesSum = listBooks(null).reduce((sum, b) => sum + (b.page_count || 0), 0);

  return (
    <div className="app-shell min-h-screen bg-stone-50 text-stone-900 pb-28">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
          <div
            className={`max-w-md w-full px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold flex items-center justify-between transition-all transform animate-bounce-short ${
              notification.type === 'error'
                ? 'bg-red-900 text-white border-red-800'
                : 'bg-stone-900 text-white border-stone-800'
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-3 text-white/70 hover:text-white pointer-events-auto"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="app-container max-w-md mx-auto px-4 pt-6">

        {/* App Header */}
        <header className="app-header mb-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-burgundy-900 text-white flex items-center justify-center shadow-md shadow-burgundy-900/20">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-stone-900 leading-none tracking-tight">Moje Knihovna</h1>
              <p className="text-[11px] font-medium text-stone-400 mt-0.5">Osobní digitální sbírka</p>
            </div>
          </div>
          <div className="bg-white px-3 py-1.5 rounded-full border border-stone-200/80 shadow-xs flex items-center space-x-1.5 text-xs font-bold text-burgundy-900">
            <span>{allBooksCount}</span>
            <span className="text-[11px] font-normal text-stone-500">knih celkem</span>
          </div>
        </header>

        {/* Tab 1: Library View */}
        {activeTab === 'library' && (
          <main className="app-view library-view space-y-4">
            {/* IF NO LIBRARY SELECTED: Show list of libraries (Folders) */}
            {!selectedLibraryId ? (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-sm font-bold text-stone-800">Moje knihovny</h2>
                    <p className="text-[11px] text-stone-400">Vyber složku nebo vytvoř novou</p>
                  </div>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-burgundy-900 text-white hover:bg-burgundy-800 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Nová knihovna</span>
                  </button>
                </div>

                {libraries.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 border border-stone-200/80 text-center shadow-sm my-4">
                    <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
                      <Folder className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-stone-900 mb-1">Žádná knihovna</h3>
                    <p className="text-stone-500 text-xs max-w-xs mx-auto mb-5">
                      Nemáš vytvořenou žádnou knihovnu. Vytvoř si svou první složku na knihy.
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 bg-burgundy-900 text-white text-xs font-semibold rounded-xl shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Vytvořit knihovnu</span>
                    </button>
                  </div>
                ) : (
                  <div className="library-list space-y-3">
                    {libraries.map((lib) => {
                      const count = listBooks(lib.id).length;
                      return (
                        <div
                          key={lib.id}
                          onClick={() => handleSelectLibraryToOpen(lib.id)}
                          className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98]"
                        >
                          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-2xl bg-burgundy-50 text-burgundy-900 flex items-center justify-center flex-shrink-0 group-hover:bg-burgundy-900 group-hover:text-white transition-colors">
                              <Library className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1 pr-2">
                              <h3 className="font-bold text-stone-900 text-sm truncate group-hover:text-burgundy-900 transition-colors">
                                {lib.name}
                              </h3>
                              <p className="text-stone-400 text-xs font-medium mt-0.5">
                                {count} {count === 1 ? 'kniha' : count >= 2 && count <= 4 ? 'knihy' : 'knih'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              title="Přejmenovat"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLibrary(lib);
                                setEditLibraryName(lib.name);
                              }}
                              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              title="Smazat"
                              onClick={(e) => handleDeleteLibrary(lib.id, lib.name, e)}
                              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-5 h-5 text-stone-300 ml-1 group-hover:text-stone-500 transition-colors" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* IF LIBRARY IS SELECTED: Show books inside that library */
              <div className="space-y-4 animate-fade-in">
                {/* Back to Libraries List Header */}
                <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-stone-200/80 shadow-xs">
                  <button
                    onClick={() => {
                      setSelectedLibraryId(null);
                      setSearchQuery('');
                    }}
                    className="flex items-center space-x-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Zpět na přehled knihoven</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      title="Přejmenovat knihovnu"
                      onClick={() => {
                        if (currentLibraryObject) {
                          setEditingLibrary(currentLibraryObject);
                          setEditLibraryName(currentLibraryObject.name);
                        }
                      }}
                      className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      title="Smazat knihovnu"
                      onClick={() => {
                        if (currentLibraryObject) {
                          handleDeleteLibrary(currentLibraryObject.id, currentLibraryObject.name);
                        }
                      }}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Library Title Banner */}
                <div className="bg-stone-900 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Aktuální knihovna</span>
                    <h2 className="text-lg font-bold leading-tight mt-0.5">{currentLibraryObject?.name || 'Knihovna'}</h2>
                  </div>
                  <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-stone-200">
                    {books.length} {books.length === 1 ? 'kniha' : books.length >= 2 && books.length <= 4 ? 'knihy' : 'knih'}
                  </div>
                </div>

                {/* Search Bar */}
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onClear={() => setSearchQuery('')}
                />

                {/* List Header */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    {searchQuery ? 'Výsledky vyhledávání' : 'Knihy v této knihovně'}
                  </h3>
                </div>

                {/* Loading / Books / Empty State */}
                {loading ? (
                  <LoadingSkeleton count={4} />
                ) : books.length > 0 ? (
                  <div className="book-list space-y-3">
                    {books.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onClick={() => setSelectedBook(book)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    onScanClick={() => {
                      setTargetScanLibraryId(selectedLibraryId);
                      setActiveTab('scan');
                    }}
                    isFiltered={Boolean(searchQuery)}
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                  />
                )}
              </div>
            )}
          </main>
        )}

        {/* Tab 2: Scanner View */}
        {/* Unmounted while a result modal is open, so the camera restarts fresh for the next book */}
        {activeTab === 'scan' && !scannedPreviewBook && !manualEntryIsbn && (
          <BookScanner
            libraries={libraries}
            selectedLibraryId={targetScanLibraryId || getActiveLibraryId() || ''}
            onSelectLibrary={handleSelectTargetScanLibrary}
            onIsbnDetected={handleIsbnDetected}
            onClose={() => setActiveTab('library')}
          />
        )}

        {/* Tab 3: Profile View */}
        {activeTab === 'profile' && (
          <ProfileView
            totalBooks={allBooksCount}
            totalPages={totalPagesSum}
          />
        )}

      </div>

      {/* Modal: Create Library */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900 flex items-center space-x-2">
                <FolderPlus className="w-4 h-4 text-burgundy-900" />
                <span>Vytvořit novou knihovnu</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLibrary} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Název knihovny
                </label>
                <input
                  type="text"
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  placeholder="Např. Sci-fi, Domácí knihovna, Přečteno..."
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-burgundy-900 hover:bg-burgundy-800 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Vytvořit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Library */}
      {editingLibrary && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900 flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-burgundy-900" />
                <span>Přejmenovat knihovnu</span>
              </h3>
              <button
                onClick={() => setEditingLibrary(null)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenameLibrary} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                  Nový název
                </label>
                <input
                  type="text"
                  value={editLibraryName}
                  onChange={(e) => setEditLibraryName(e.target.value)}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLibrary(null)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-burgundy-900 hover:bg-burgundy-800 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Uložit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Detail Modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onDelete={handleDeleteBook}
        />
      )}

      {/* Book Preview Modal (after scanning/lookup) */}
      {scannedPreviewBook && (
        <BookPreviewModal
          book={scannedPreviewBook}
          alreadyInLibrary={isDuplicateAlert}
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

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}
