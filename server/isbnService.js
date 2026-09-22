/**
 * Normalizes ISBN string (removes hyphens, spaces, converts to uppercase)
 */
export function cleanIsbn(isbnStr) {
  if (!isbnStr) return '';
  return String(isbnStr).replace(/[- \s]/g, '').trim().toUpperCase();
}

/**
 * Validates whether string is ISBN-10 or ISBN-13 / EAN-13
 */
export function validateIsbn(isbnStr) {
  const cleaned = cleanIsbn(isbnStr);
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(cleaned)) {
    return { valid: false, type: 'UNKNOWN', clean: cleaned };
  }
  if (cleaned.length === 10) {
    return { valid: true, type: 'ISBN-10', clean: cleaned };
  }
  if (cleaned.length === 13) {
    return { valid: true, type: 'ISBN-13', clean: cleaned };
  }
  return { valid: false, type: 'UNKNOWN', clean: cleaned };
}

/**
 * Fetches book details from Google Books API
 */
async function fetchFromGoogleBooks(isbn, apiKey = '') {
  try {
    const keyParam = apiKey ? `&key=${apiKey}` : '';
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${keyParam}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MojeKnihovna/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    const info = item.volumeInfo || {};

    let coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
    if (coverUrl && coverUrl.startsWith('http:')) {
      coverUrl = coverUrl.replace('http:', 'https:');
    }

    const authors = Array.isArray(info.authors) ? info.authors.join(', ') : (info.authors || '');

    return {
      isbn,
      title: info.title || 'Neznámý název',
      authors: authors || 'Neznámý autor',
      cover_url: coverUrl,
      publication_date: info.publishedDate || '',
      publisher: info.publisher || '',
      page_count: info.pageCount || null,
      description: info.description || '',
      source: 'Google Books'
    };
  } catch (err) {
    console.error('Google Books API fetch error:', err.message);
    return null;
  }
}

/**
 * Fetches book details from Open Library Search API
 */
async function fetchFromOpenLibrarySearch(isbn) {
  try {
    const url = `https://openlibrary.org/search.json?q=isbn:${encodeURIComponent(isbn)}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MojeKnihovna/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;

    const doc = data.docs[0];
    const authors = Array.isArray(doc.author_name) ? doc.author_name.join(', ') : '';
    const publisher = Array.isArray(doc.publisher) ? doc.publisher[0] : '';
    const coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

    return {
      isbn,
      title: doc.title || 'Neznámý název',
      authors: authors || 'Neznámý autor',
      cover_url: coverUrl,
      publication_date: doc.first_publish_year ? String(doc.first_publish_year) : (doc.publish_date ? doc.publish_date[0] : ''),
      publisher: publisher || '',
      page_count: doc.number_of_pages_median || null,
      description: '',
      source: 'Open Library Search'
    };
  } catch (err) {
    console.error('Open Library Search API error:', err.message);
    return null;
  }
}

/**
 * Direct fallback for Open Library ISBN Edition API
 */
async function fetchFromOpenLibraryEdition(isbn) {
  try {
    const url = `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MojeKnihovna/1.0' } });
    if (!res.ok) return null;
    const book = await res.json();

    const publishers = Array.isArray(book.publishers) ? book.publishers.join(', ') : '';
    const coverUrl = book.covers && book.covers.length > 0 ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

    return {
      isbn,
      title: book.title || 'Neznámý název',
      authors: 'Neznámý autor',
      cover_url: coverUrl,
      publication_date: book.publish_date || '',
      publisher: publishers || '',
      page_count: book.number_of_pages || null,
      description: typeof book.description === 'string' ? book.description : (book.description?.value || ''),
      source: 'Open Library ISBN'
    };
  } catch (err) {
    console.error('Open Library Edition API error:', err.message);
    return null;
  }
}

/**
 * Main lookup function combining primary & fallback APIs
 */
export async function lookupBookByIsbn(isbnStr) {
  const validation = validateIsbn(isbnStr);
  if (!validation.valid) {
    return {
      success: false,
      error: 'Nespravný formát čárového kódu nebo ISBN. Prosím zkontrolujte kód.',
      rawInput: isbnStr
    };
  }

  const clean = validation.clean;
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || '';

  // 1. Try Google Books
  let bookData = await fetchFromGoogleBooks(clean, apiKey);

  // 2. Try Open Library Search
  if (!bookData) {
    bookData = await fetchFromOpenLibrarySearch(clean);
  }

  // 3. Try Open Library Edition JSON
  if (!bookData) {
    bookData = await fetchFromOpenLibraryEdition(clean);
  }

  if (bookData) {
    return {
      success: true,
      isbn: clean,
      type: validation.type,
      book: bookData
    };
  }

  return {
    success: false,
    error: `Kniha s ISBN ${clean} nebyla v databázích nalezena.`,
    isbn: clean,
    type: validation.type
  };
}
