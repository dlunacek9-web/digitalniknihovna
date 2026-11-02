/**
 * Knihovny.cz API Service
 * Handles direct browser fetch calls to https://www.knihovny.cz/api/v1/search
 */

export const KNIHOVNY_API_URL = 'https://www.knihovny.cz/api/v1/search';

export const REQUESTED_FIELDS = [
  'id',
  'title',
  'authors',
  'publishers',
  'placesOfPublication',
  'publicationDates',
  'physicalDescriptions',
  'isbns',
  'issns',
  'cnb',
  'formats'
];

/**
 * Clean digits from ISBN / barcode string.
 * Strips notes like "(brož.)" and non-digit characters (except X for ISBN-10 check digit).
 */
export function cleanIsbnDigits(isbnStr) {
  if (!isbnStr) return '';
  const str = String(isbnStr).split('(')[0].trim();
  return str.replace(/[^0-9X]/gi, '').toUpperCase();
}

/**
 * Converts ISBN-10 string (or 10 digits) to 13-digit ISBN (ISBN-13 starting with 978).
 * If input is already 13 digits, returns 13 digits.
 */
export function toIsbn13(isbnStr) {
  const digits = cleanIsbnDigits(isbnStr);

  if (digits.length === 13) {
    return digits;
  }

  if (digits.length === 10) {
    const prefix = '978' + digits.substring(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(prefix[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return prefix + checkDigit;
  }

  return digits;
}

/**
 * Removes cataloging punctuation trailing characters (e.g., ",", ":", "/", ";", "=")
 * and trims spaces/brackets.
 */
export function cleanCatalogText(text) {
  if (!text) return '';
  let cleaned = String(text).trim();

  // Strip trailing catalog punctuation like ",", ":", "/", ";", "="
  cleaned = cleaned.replace(/[\s,:/;=]+$/, '').trim();

  // Strip surrounding brackets if it's enclosed like "[Praha]" -> "Praha"
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/**
 * Extracts 4-digit year from publicationDates array or string (e.g., "c2010", "[2025]").
 */
export function parseYear(publicationDates) {
  if (!publicationDates) return '';
  const datesArray = Array.isArray(publicationDates) ? publicationDates : [publicationDates];
  for (const dateStr of datesArray) {
    if (!dateStr) continue;
    const match = String(dateStr).match(/\d{4}/);
    if (match) {
      return match[0];
    }
  }
  return '';
}

/**
 * Cleans author name string by stripping birth/death years at the end.
 * E.g., "Jean de Nostredame, asi 1507-1577" -> "Jean de Nostredame"
 *       "Josef Prokop, 1971-" -> "Josef Prokop"
 */
export function cleanAuthorName(nameStr) {
  if (!nameStr) return '';
  let name = String(nameStr).trim();
  // Strip trailing years e.g., ", asi 1507-1577", ", 1971-", ", 1971-2020", ", 1507?-1577"
  name = name.replace(/,\s*(?:asi\s*)?\d{3,4}\??\s*-\s*\d{0,4}\??$/i, '');
  name = name.replace(/,\s*\d{3,4}\??$/i, '');
  return name.trim();
}

/**
 * Parses authors object from Knihovny.cz response format:
 * {
 *   primary: { "Author Name, years": [] },
 *   secondary: { "Translator Name, years": [] },
 *   corporate: []
 * }
 */
export function parseAuthors(authorsObj) {
  if (!authorsObj) return 'Neznámý autor';

  const primaryKeys = authorsObj.primary ? Object.keys(authorsObj.primary) : [];
  const secondaryKeys = authorsObj.secondary ? Object.keys(authorsObj.secondary) : [];

  const primaryNames = primaryKeys.map(cleanAuthorName).filter(Boolean);
  if (primaryNames.length > 0) {
    return primaryNames.join(', ');
  }

  const secondaryNames = secondaryKeys.map(cleanAuthorName).filter(Boolean);
  if (secondaryNames.length > 0) {
    return secondaryNames.join(', ');
  }

  if (Array.isArray(authorsObj.corporate) && authorsObj.corporate.length > 0) {
    return authorsObj.corporate.map(cleanAuthorName).filter(Boolean).join(', ');
  }

  return 'Neznámý autor';
}

/**
 * Parses physical descriptions to extract page count integer.
 * E.g., "218 s. : il. ; 22 cm" -> 218
 *       "260 stran" -> 260
 */
export function parsePageCount(physicalDescriptions) {
  if (!physicalDescriptions) return null;
  const descArray = Array.isArray(physicalDescriptions) ? physicalDescriptions : [physicalDescriptions];
  for (const desc of descArray) {
    if (!desc) continue;
    const match = String(desc).match(/(\d+)\s*(?:s\.|stran|s\b|p\.)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Normalizes a single raw record from Knihovny.cz API into application book object structure.
 */
export function normalizeRecord(record) {
  if (!record) return null;

  const rawTitle = record.title || '';
  const title = cleanCatalogText(rawTitle) || 'Neznámý název';

  const authors = parseAuthors(record.authors);

  const rawPublishers = Array.isArray(record.publishers) ? record.publishers.join(', ') : (record.publishers || '');
  const publisher = cleanCatalogText(rawPublishers);

  const publicationDate = parseYear(record.publicationDates);

  const pageCount = parsePageCount(record.physicalDescriptions);

  // Extract cleaned primary ISBN
  let primaryIsbn = '';
  if (Array.isArray(record.isbns) && record.isbns.length > 0) {
    primaryIsbn = toIsbn13(record.isbns[0]);
  }

  return {
    id: record.id ?? null,
    isbn: primaryIsbn,
    title,
    authors,
    publisher,
    publication_date: publicationDate,
    page_count: pageCount,
    description: '',
    cover_url: null,
    cnb: record.cnb ?? null,
    formats: record.formats ?? [],
    rawIsbns: record.isbns ?? []
  };
}

/**
 * Directly queries Knihovny.cz API using browser fetch.
 *
 * @param {Object} params
 * @param {string} params.lookfor Search string or number
 * @param {'ISN'|'Title'|'Author'|'AllFields'|'adv_search_nbn'} params.type Search type
 * @param {number|string} [params.limit=10] Max records limit (0..100)
 * @returns {Promise<Array<Object>>} Array of raw records
 */
export async function searchKnihovnyApi({ lookfor, type, limit = 10 }) {
  const allowedTypes = ['ISN', 'Title', 'Author', 'AllFields', 'adv_search_nbn'];
  if (!allowedTypes.includes(type)) {
    throw new Error(`Invalid search type: ${type}. Allowed: ${allowedTypes.join(', ')}`);
  }

  const p = new URLSearchParams({
    lookfor,
    type,
    limit: String(limit)
  });

  for (const field of REQUESTED_FIELDS) {
    p.append('field[]', field);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${KNIHOVNY_API_URL}?${p.toString()}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Knihovny.cz API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.records ?? [];
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Časový limit pro vyhledávání vypršel (8s).');
    }
    throw err;
  }
}

/**
 * Converts a 978-prefixed ISBN-13 to ISBN-10. Older Czech books are often
 * indexed in Knihovny.cz only under their ISBN-10, so the ISBN-13 search misses them.
 * Returns '' when no ISBN-10 exists (e.g. 979 prefix).
 */
export function toIsbn10(isbnStr) {
  const digits = cleanIsbnDigits(isbnStr);
  if (digits.length === 10) return digits;
  if (digits.length !== 13 || !digits.startsWith('978')) return '';

  const core = digits.substring(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function findInKnihovny(isbn13) {
  const queries = [isbn13];
  const isbn10 = toIsbn10(isbn13);
  if (isbn10) queries.push(isbn10);

  for (const lookfor of queries) {
    const records = await searchKnihovnyApi({ lookfor, type: 'ISN', limit: 10 });
    // Find the record whose isbns array actually contains the searched ISBN
    const matchingRecord = (records || []).find((rec) => {
      if (!Array.isArray(rec.isbns)) return false;
      return rec.isbns.some((rawIsbn) => toIsbn13(rawIsbn) === isbn13);
    });
    if (matchingRecord) return normalizeRecord(matchingRecord);
  }
  return null;
}

async function findInGoogleBooks(isbn13) {
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`);
  const info = data?.items?.[0]?.volumeInfo;
  if (!info || !info.title) return null;

  const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
  return {
    id: null,
    isbn: isbn13,
    title: info.subtitle ? `${info.title} : ${info.subtitle}` : info.title,
    authors: Array.isArray(info.authors) && info.authors.length ? info.authors.join(', ') : 'Neznámý autor',
    publisher: info.publisher || '',
    publication_date: parseYear(info.publishedDate),
    page_count: info.pageCount || null,
    description: info.description || '',
    cover_url: thumb ? thumb.replace(/^http:/, 'https:') : null,
    cnb: null,
    formats: [],
    rawIsbns: []
  };
}

async function findInOpenLibrary(isbn13) {
  const fields = 'title,subtitle,author_name,publisher,first_publish_year,publish_year,number_of_pages_median,cover_i';
  const data = await fetchJson(`https://openlibrary.org/search.json?q=isbn:${isbn13}&limit=1&fields=${fields}`);
  const doc = data?.docs?.[0];
  if (!doc || !doc.title) return null;

  const year = Array.isArray(doc.publish_year) && doc.publish_year.length
    ? String(Math.max(...doc.publish_year))
    : (doc.first_publish_year ? String(doc.first_publish_year) : '');
  return {
    id: null,
    isbn: isbn13,
    title: doc.subtitle ? `${doc.title} : ${doc.subtitle}` : doc.title,
    authors: Array.isArray(doc.author_name) && doc.author_name.length ? doc.author_name.join(', ') : 'Neznámý autor',
    publisher: Array.isArray(doc.publisher) ? doc.publisher[0] : '',
    publication_date: year,
    page_count: doc.number_of_pages_median || null,
    description: '',
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    cnb: null,
    formats: [],
    rawIsbns: []
  };
}

/**
 * Looks up a book by ISBN.
 * Tries Knihovny.cz first (ISBN-13, then ISBN-10), then Google Books and Open Library,
 * so books missing from Czech library catalogs are still found.
 *
 * @param {string} isbnStr
 * @returns {Promise<{ success: boolean, book?: Object, error?: string }>}
 */
export async function lookupByIsbn(isbnStr) {
  const isbn13 = toIsbn13(isbnStr);
  if (!isbn13 || isbn13.length !== 13) {
    return {
      success: false,
      error: 'Neplatný formát ISBN.'
    };
  }

  let knihovnyError = null;
  let book = null;
  try {
    book = await findInKnihovny(isbn13);
  } catch (err) {
    knihovnyError = err;
  }

  if (!book) book = await findInGoogleBooks(isbn13);
  if (!book) book = await findInOpenLibrary(isbn13);

  if (book) {
    // Ensure the book's main ISBN is set to searched 13-digit ISBN
    book.isbn = isbn13;
    return { success: true, book };
  }

  if (knihovnyError) {
    return {
      success: false,
      error: knihovnyError.message || 'Nepodařilo se vyhledat informace o knize.'
    };
  }

  return {
    success: false,
    error: `Kniha s ISBN ${isbn13} nebyla v katalogu Knihovny.cz ani v dalších databázích nalezena.`
  };
}
