import { cleanIsbnDigits } from './knihovnyApi';

const BOOKS_STORAGE_KEY = 'digitalniknihovna.books.v1';
const LIBRARIES_STORAGE_KEY = 'digitalniknihovna.libraries.v1';
const ACTIVE_LIB_STORAGE_KEY = 'digitalniknihovna.active_lib.v1';

function readLibraries() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIBRARIES_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) {
      return saved;
    }
  } catch (err) {
    console.error('Error reading libraries from localStorage:', err);
  }

  // Initialize default library if none exists
  const defaultLib = {
    id: 'lib_default_1',
    name: 'Knihovna 1',
    created_at: new Date().toISOString()
  };
  const initial = [defaultLib];
  writeLibraries(initial);

  // Migrate legacy books without library_id to default library
  const books = readBooksRaw();
  if (books.length > 0) {
    let migrated = false;
    const updatedBooks = books.map((b) => {
      if (!b.library_id) {
        migrated = true;
        return { ...b, library_id: defaultLib.id };
      }
      return b;
    });
    if (migrated) {
      writeBooksRaw(updatedBooks);
    }
  }

  return initial;
}

function writeLibraries(libraries) {
  try {
    localStorage.setItem(LIBRARIES_STORAGE_KEY, JSON.stringify(libraries));
  } catch (err) {
    console.error('Error writing libraries to localStorage:', err);
  }
}

function readBooksRaw() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKS_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeBooksRaw(books) {
  try {
    localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(books));
  } catch (err) {
    console.error('Error writing books to localStorage:', err);
  }
}

export function getLibraries() {
  return readLibraries();
}

export function addLibrary(name) {
  const libraries = readLibraries();
  const trimmedName = String(name || '').trim() || 'Nová knihovna';
  const newLib = {
    id: `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    created_at: new Date().toISOString()
  };
  const updated = [...libraries, newLib];
  writeLibraries(updated);

  // Set as active library if it's the first or user created it
  setActiveLibraryId(newLib.id);
  return newLib;
}

export function renameLibrary(id, newName) {
  const libraries = readLibraries();
  const trimmedName = String(newName || '').trim();
  if (!trimmedName) return false;

  const updated = libraries.map((lib) =>
    lib.id === id ? { ...lib, name: trimmedName } : lib
  );
  writeLibraries(updated);
  return true;
}

export function deleteLibrary(id) {
  const libraries = readLibraries();
  const remainingLibs = libraries.filter((lib) => lib.id !== id);
  writeLibraries(remainingLibs);

  // Delete all books in this library
  const books = readBooksRaw();
  const remainingBooks = books.filter((b) => (b.library_id || 'lib_default_1') !== id);
  writeBooksRaw(remainingBooks);

  // Update active library if needed
  const activeId = getActiveLibraryId();
  if (activeId === id) {
    if (remainingLibs.length > 0) {
      setActiveLibraryId(remainingLibs[0].id);
    } else {
      localStorage.removeItem(ACTIVE_LIB_STORAGE_KEY);
    }
  }
  return true;
}

export function getActiveLibraryId() {
  const activeId = localStorage.getItem(ACTIVE_LIB_STORAGE_KEY);
  const libraries = readLibraries();

  if (activeId && libraries.some((lib) => lib.id === activeId)) {
    return activeId;
  }

  if (libraries.length > 0) {
    const defaultId = libraries[0].id;
    setActiveLibraryId(defaultId);
    return defaultId;
  }

  return null;
}

export function setActiveLibraryId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_LIB_STORAGE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_LIB_STORAGE_KEY);
  }
}

export function listBooks(libraryId = null, query = '') {
  let books = readBooksRaw();

  if (libraryId) {
    books = books.filter((book) => (book.library_id || 'lib_default_1') === libraryId);
  }

  books.sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  );

  const needle = query.trim().toLocaleLowerCase('cs');
  if (!needle) return books;

  return books.filter((book) =>
    [book.title, book.authors, book.isbn, book.publisher]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('cs').includes(needle))
  );
}

export function addBook(book, targetLibraryId = null) {
  let libId = targetLibraryId || getActiveLibraryId();

  // If no library exists, create default "Knihovna 1"
  if (!libId) {
    const newLib = addLibrary('Knihovna 1');
    libId = newLib.id;
  }

  const books = readBooksRaw();
  const isbn = cleanIsbnDigits(book.isbn);

  const duplicate =
    isbn &&
    books.some(
      (savedBook) =>
        (savedBook.library_id || 'lib_default_1') === libId &&
        cleanIsbnDigits(savedBook.isbn) === isbn
    );

  if (duplicate) {
    return { success: false, duplicate: true };
  }

  const savedBook = {
    ...book,
    id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    library_id: libId,
    isbn,
    title: String(book.title || '').trim(),
    authors: String(book.authors || 'Neznámý autor').trim(),
    page_count: book.page_count ? Number.parseInt(book.page_count, 10) : null,
    created_at: new Date().toISOString()
  };

  writeBooksRaw([savedBook, ...books]);
  return { success: true, book: savedBook };
}

export function deleteBook(id) {
  const books = readBooksRaw();
  const remainingBooks = books.filter((book) => book.id !== id);

  if (remainingBooks.length === books.length) {
    return false;
  }

  writeBooksRaw(remainingBooks);
  return true;
}
