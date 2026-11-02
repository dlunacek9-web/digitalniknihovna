import { classifyGenre } from './genres';
import { cleanIsbnDigits, normalizeRecord, parseYear, searchKnihovnyApi, toIsbn13 } from './knihovnyApi';

/**
 * Celosvětové hledání knih pro městskou knihovnu.
 * Dotazuje Knihovny.cz, Google Books a Open Library současně a výsledky slije.
 */

export const SEARCH_SCOPES = [
  { id: 'all', label: 'Všude' },
  { id: 'title', label: 'Název' },
  { id: 'author', label: 'Autor' },
  { id: 'isbn', label: 'ISBN' }
];

export const SEARCH_LANGS = [
  { id: 'any', label: 'Všechny jazyky', google: '', openLibrary: '' },
  { id: 'cs', label: 'Česky', google: 'cs', openLibrary: 'cze' },
  { id: 'sk', label: 'Slovensky', google: 'sk', openLibrary: 'slo' },
  { id: 'en', label: 'Anglicky', google: 'en', openLibrary: 'eng' },
  { id: 'de', label: 'Německy', google: 'de', openLibrary: 'ger' }
];

const MAX_RESULTS = 24;

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function normalizeGoogleItem(item) {
  const info = item?.volumeInfo;
  if (!info?.title) return null;

  const ids = info.industryIdentifiers || [];
  const rawIsbn = (ids.find((i) => i.type === 'ISBN_13') || ids.find((i) => i.type === 'ISBN_10'))?.identifier || '';
  const isbn = toIsbn13(rawIsbn);
  const categories = Array.isArray(info.categories) ? info.categories : [];
  const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;

  return {
    id: null,
    isbn: isbn.length === 13 ? isbn : '',
    title: info.subtitle ? `${info.title} : ${info.subtitle}` : info.title,
    authors: Array.isArray(info.authors) && info.authors.length ? info.authors.join(', ') : 'Neznámý autor',
    publisher: info.publisher || '',
    publication_date: parseYear(info.publishedDate),
    page_count: info.pageCount || null,
    genre: classifyGenre(categories) || categories[0]?.split(' / ')[0] || null,
    description: info.description || '',
    cover_url: thumb ? thumb.replace(/^http:/, 'https:') : null,
    cnb: null,
    formats: [],
    rawIsbns: [],
    source: 'Google Books'
  };
}

export function normalizeOpenLibraryDoc(doc) {
  if (!doc?.title) return null;
  const isbn = (doc.isbn || []).map(cleanIsbnDigits).find((i) => i.length === 13) || '';
  const subjects = Array.isArray(doc.subject) ? doc.subject.slice(0, 12) : [];

  return {
    id: null,
    isbn,
    title: doc.subtitle ? `${doc.title} : ${doc.subtitle}` : doc.title,
    authors: Array.isArray(doc.author_name) && doc.author_name.length ? doc.author_name.join(', ') : 'Neznámý autor',
    publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : '',
    publication_date: doc.first_publish_year ? String(doc.first_publish_year) : '',
    page_count: doc.number_of_pages_median || null,
    genre: classifyGenre(subjects),
    description: '',
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    cnb: null,
    formats: [],
    rawIsbns: [],
    source: 'Open Library'
  };
}

async function searchGoogle(query, scope, lang) {
  const q = { title: `intitle:${query}`, author: `inauthor:${query}`, isbn: `isbn:${cleanIsbnDigits(query)}` }[scope] || query;
  const params = new URLSearchParams({ q, maxResults: '20', printType: 'books' });
  if (lang.google) params.set('langRestrict', lang.google);
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params}`);
  return (data.items || []).map(normalizeGoogleItem).filter(Boolean);
}

async function searchOpenLibrary(query, scope, lang) {
  const key = { title: 'title', author: 'author', isbn: 'isbn' }[scope] || 'q';
  const params = new URLSearchParams({
    [key]: scope === 'isbn' ? cleanIsbnDigits(query) : query,
    limit: '20',
    fields: 'title,subtitle,author_name,publisher,first_publish_year,number_of_pages_median,cover_i,isbn,subject'
  });
  if (lang.openLibrary) params.set('language', lang.openLibrary);
  const data = await fetchJson(`https://openlibrary.org/search.json?${params}`);
  return (data.docs || []).map(normalizeOpenLibraryDoc).filter(Boolean);
}

async function searchCzechCatalog(query, scope) {
  const type = { title: 'Title', author: 'Author', isbn: 'ISN' }[scope] || 'AllFields';
  const records = await searchKnihovnyApi({
    lookfor: scope === 'isbn' ? cleanIsbnDigits(query) : query,
    type,
    limit: 20
  });
  return records.map((r) => ({ ...normalizeRecord(r), source: 'Knihovny.cz' }));
}

const keyOf = (book) => book.isbn || `${book.title}|${book.authors}`.toLocaleLowerCase('cs');

/** Slije výsledky z více zdrojů, bez duplicit; chybějící údaje doplní z dalšího zdroje. */
export function mergeResults(lists, limit = MAX_RESULTS) {
  const merged = new Map();
  const order = [];
  // prokládání, ať jeden zdroj nezaplaví celý seznam
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const book = list[i];
      if (!book) continue;
      const key = keyOf(book);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...book });
        order.push(key);
      } else {
        for (const field of ['cover_url', 'publisher', 'publication_date', 'page_count', 'genre', 'description']) {
          if (!existing[field] && book[field]) existing[field] = book[field];
        }
      }
    }
  }
  return order.slice(0, limit).map((key) => merged.get(key));
}

/**
 * @param {{ query: string, scope?: 'all'|'title'|'author'|'isbn', lang?: string }} params
 * @returns {Promise<{ books: Object[], failed: number }>}
 */
export async function searchWorldBooks({ query, scope = 'all', lang = 'any' }) {
  const text = String(query || '').trim();
  if (text.length < 2) return { books: [], failed: 0 };

  const langDef = SEARCH_LANGS.find((l) => l.id === lang) || SEARCH_LANGS[0];
  const jobs = [searchGoogle(text, scope, langDef), searchOpenLibrary(text, scope, langDef)];
  // Český katalog dává smysl jen pro češtinu a slovenštinu (nebo bez omezení jazyka).
  const czechCatalog = lang === 'any' || lang === 'cs' || lang === 'sk';
  if (czechCatalog) jobs.unshift(searchCzechCatalog(text, scope));

  const settled = await Promise.allSettled(jobs);
  const lists = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));
  const failed = settled.filter((r) => r.status === 'rejected').length;
  return { books: mergeResults(lists), failed };
}

const BROWSE_PAGE_SIZE = 30;

/**
 * Výchozí nekonečný seznam knih, dokud se nehledá: oblíbené tituly z Open Library po stránkách.
 * @returns {Promise<{ books: Object[], hasMore: boolean }>}
 */
export async function browseWorldBooks({ lang = 'any', page = 1 } = {}) {
  const langDef = SEARCH_LANGS.find((l) => l.id === lang) || SEARCH_LANGS[0];
  const params = new URLSearchParams({
    q: 'subject:fiction',
    sort: 'editions',
    limit: String(BROWSE_PAGE_SIZE),
    page: String(page),
    fields: 'title,subtitle,author_name,publisher,first_publish_year,number_of_pages_median,cover_i,isbn,subject'
  });
  if (langDef.openLibrary) params.set('language', langDef.openLibrary);
  const data = await fetchJson(`https://openlibrary.org/search.json?${params}`);
  const docs = data.docs || [];
  return {
    books: docs.map(normalizeOpenLibraryDoc).filter(Boolean),
    hasMore: docs.length === BROWSE_PAGE_SIZE
  };
}
