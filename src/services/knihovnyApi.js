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
 * Looks up a book by ISBN from Knihovny.cz API.
 * Converts input ISBN to 13-digit format, queries API with limit=10,
 * and finds record that explicitly contains the matching 13-digit ISBN in its `isbns` array.
 *
 * @param {string} isbnStr
 * @returns {Promise<{ success: boolean, book?: Object, error?: string }>}
 */
export async function lookupByIsbn(isbnStr) {
  const isbn13 = toIsbn13(isbnStr);
  if (!isbn13 || (isbn13.length !== 10 && isbn13.length !== 13)) {
    return {
      success: false,
      error: 'Neplatný formát ISBN.'
    };
  }

  try {
    const records = await searchKnihovnyApi({
      lookfor: isbn13,
      type: 'ISN',
      limit: 10
    });

    if (!records || records.length === 0) {
      return {
        success: false,
        error: `Kniha s ISBN ${isbnStr} nebyla v katalogu Knihovny.cz nalezena.`
      };
    }

    // Find the record whose isbns array actually contains the searched 13-digit ISBN
    const matchingRecord = records.find((rec) => {
      if (!Array.isArray(rec.isbns)) return false;
      return rec.isbns.some((rawIsbn) => toIsbn13(rawIsbn) === isbn13);
    });

    if (!matchingRecord) {
      return {
        success: false,
        error: `Kniha s ISBN ${isbnStr} nebyla v katalogu Knihovny.cz nalezena.`
      };
    }

    const normalizedBook = normalizeRecord(matchingRecord);
    // Ensure the book's main ISBN is set to searched 13-digit ISBN
    normalizedBook.isbn = isbn13;

    return {
      success: true,
      book: normalizedBook
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Nepodařilo se vyhledat informace o knize.'
    };
  }
}
