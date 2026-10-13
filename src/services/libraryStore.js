import { cleanIsbnDigits } from './knihovnyApi';

const STORAGE_KEY = 'digitalniknihovna.books.v1';

function readBooks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeBooks(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

export function listBooks(query = '') {
  const books = readBooks().sort((a, b) =>
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

export function addBook(book) {
  const books = readBooks();
  const isbn = cleanIsbnDigits(book.isbn);
  const duplicate = isbn && books.some((savedBook) => cleanIsbnDigits(savedBook.isbn) === isbn);

  if (duplicate) {
    return { success: false, duplicate: true };
  }

  const savedBook = {
    ...book,
    id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    isbn,
    title: String(book.title || '').trim(),
    authors: String(book.authors || 'Neznámý autor').trim(),
    page_count: book.page_count ? Number.parseInt(book.page_count, 10) : null,
    created_at: new Date().toISOString()
  };

  writeBooks([savedBook, ...books]);
  return { success: true, book: savedBook };
}

export function deleteBook(id) {
  const books = readBooks();
  const remainingBooks = books.filter((book) => book.id !== id);

  if (remainingBooks.length === books.length) {
    return false;
  }

  writeBooks(remainingBooks);
  return true;
}
