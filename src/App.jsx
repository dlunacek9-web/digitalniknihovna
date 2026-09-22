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
import { BookMarked, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'scan' | 'profile'
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);

  // Scanner state
  const [scannedPreviewBook, setScannedPreviewBook] = useState(null);
  const [isDuplicateAlert, setIsDuplicateAlert] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch books on mount or search
  const fetchBooks = async (query = '') => {
    setLoading(true);
    try {
      const url = query ? `/api/books?q=${encodeURIComponent(query)}` : '/api/books';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setBooks(data.books || []);
      }
    } catch (err) {
      console.error('Error fetching books:', err);
      showNotification('Nepodařilo se načíst knihy z databáze.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks(searchQuery);
  }, [searchQuery]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // Delete book from library
  const handleDeleteBook = async (id) => {
    try {
      const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotification('Kniha byla úspěšně odstraněna z knihovny.');
        setSelectedBook(null);
        fetchBooks(searchQuery);
      } else {
        showNotification(data.error || 'Nepodařilo se odstranit knihu.', 'error');
      }
    } catch (err) {
      showNotification('Chyba při komunikaci se serverem.', 'error');
    }
  };

  // Save book from preview
  const handleSaveBook = async (bookData) => {
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookData)
      });
      const data = await res.json();

      if (res.status === 409) {
        showNotification('Tuto knihu už v knihovně máš.', 'error');
        setScannedPreviewBook(null);
        setActiveTab('library');
        return;
      }

      if (data.success) {
        showNotification('Kniha byla úspěšně přidána do knihovny!');
        setScannedPreviewBook(null);
        setActiveTab('library');
        fetchBooks();
      } else {
        showNotification(data.error || 'Při ukládání knihy došlo k chybě.', 'error');
      }
    } catch (err) {
      showNotification('Chyba připojení k databázi.', 'error');
    }
  };

  // Handle scanned ISBN from BookScanner
  const handleIsbnDetected = async (isbn) => {
    try {
      const res = await fetch(`/api/lookup-isbn/${encodeURIComponent(isbn)}`);
      const data = await res.json();

      if (!data.success) {
        showNotification(data.error || 'Knihu se nepodařilo v databázích najít.', 'error');
        return;
      }

      setScannedPreviewBook({
        ...data.book,
        alreadyInLibrary: data.alreadyInLibrary
      });
      setIsDuplicateAlert(data.alreadyInLibrary);
    } catch (err) {
      showNotification('Nepodařilo se vyhledat informace o knize. Zkontrolujte připojení.', 'error');
    }
  };

  const totalPagesSum = books.reduce((sum, b) => sum + (b.page_count || 0), 0);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-28">
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
      <div className="max-w-md mx-auto px-4 pt-6">

        {/* App Header */}
        <header className="mb-5 flex items-center justify-between">
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
            <span>{books.length}</span>
            <span className="text-[11px] font-normal text-stone-500">knih</span>
          </div>
        </header>

        {/* Tab 1: Library View */}
        {activeTab === 'library' && (
          <main className="space-y-4">
            {/* Search Bar */}
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
            />

            {/* List Header */}
            <div className="flex items-center justify-between px-1 pt-1">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                {searchQuery ? 'Výsledky vyhledávání' : 'Všechny knihy'}
              </h2>
              {searchQuery && (
                <span className="text-xs font-semibold text-stone-500">
                  {books.length} {books.length === 1 ? 'kniha' : books.length >= 2 && books.length <= 4 ? 'knihy' : 'knih'}
                </span>
              )}
            </div>

            {/* Loading / Books / Empty State */}
            {loading ? (
              <LoadingSkeleton count={4} />
            ) : books.length > 0 ? (
              <div className="space-y-3">
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
                onScanClick={() => setActiveTab('scan')}
                isFiltered={Boolean(searchQuery)}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
              />
            )}
          </main>
        )}

        {/* Tab 2: Scanner View */}
        {activeTab === 'scan' && (
          <BookScanner
            onIsbnDetected={handleIsbnDetected}
            onClose={() => setActiveTab('library')}
          />
        )}

        {/* Tab 3: Profile View */}
        {activeTab === 'profile' && (
          <ProfileView
            totalBooks={books.length}
            totalPages={totalPagesSum}
          />
        )}

      </div>

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

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}
