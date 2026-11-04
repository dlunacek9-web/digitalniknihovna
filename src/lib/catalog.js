import { cleanIsbnDigits, toIsbn13 } from '../services/knihovnyApi';

const BADGES = { reserved: 'rezervováno', on_loan: 'půjčeno' };
const UNKNOWN_AUTHOR = 'Neznámý autor';

export const EMPTY_CATALOG_FORM = {
  isbn: '',
  title: '',
  authors: '',
  publisher: '',
  year: '',
  cover_url: '',
  genre: '',
  inventory_number: ''
};

/** Předvyplní formulář z výsledku vyhledání podle ISBN. */
export function lookupToForm(book) {
  const year = String(book.publication_date || '').match(/\d{4}/)?.[0] || '';
  const cover = String(book.cover_url || '');
  const authors = book.authors === UNKNOWN_AUTHOR ? '' : book.authors || '';
  // Délky odpovídají omezením v databázi, externí záznamy bývají i delší.
  return {
    ...EMPTY_CATALOG_FORM,
    isbn: book.isbn || '',
    title: String(book.title || '').slice(0, 500),
    authors: authors.slice(0, 500),
    publisher: String(book.publisher || '').slice(0, 300),
    year,
    cover_url: cover.startsWith('https://') && cover.length <= 1000 ? cover : '',
    genre: String(book.genre || '').slice(0, 100)
  };
}

/** Doplní formulář z nalezené knihy. Co databáze nezná, zůstává podle formuláře. */
export function applyBookToForm(form, book) {
  const next = { ...form };
  for (const [key, value] of Object.entries(lookupToForm(book))) {
    if (value) next[key] = value;
  }
  return next;
}

/** Další fyzický výtisk stejného vydání: inventární číslo má každý vlastní. */
export function copyPreset(item) {
  return { ...itemToForm(item), inventory_number: '' };
}

/** Jiné vydání stejné knihy: údaje o vydání se vyplňují znovu. */
export function editionPreset(item) {
  const { title, authors, genre } = itemToForm(item);
  return { ...EMPTY_CATALOG_FORM, title, authors, genre };
}

export function itemToForm(item) {
  const form = { ...EMPTY_CATALOG_FORM };
  for (const key of Object.keys(form)) form[key] = item[key] == null ? '' : String(item[key]);
  return form;
}

const textOrNull = (value) => String(value ?? '').trim() || null;

/** Převede formulář na řádek pro databázi. Při neplatném vstupu vyhodí českou chybu. */
export function formToRow(form) {
  const title = String(form.title ?? '').trim();
  if (!title) throw new Error('Vyplň název knihy.');

  const yearText = String(form.year ?? '').trim();
  const year = yearText ? Number(yearText) : null;
  if (yearText && (!Number.isInteger(year) || year < 1 || year > 2100)) {
    throw new Error('Rok vydání musí být celé číslo, například 2015.');
  }

  const cover = textOrNull(form.cover_url);
  if (cover && !cover.startsWith('https://')) {
    throw new Error('Adresa obálky musí začínat https://.');
  }

  return {
    isbn: cleanIsbnDigits(form.isbn) || null,
    title,
    authors: textOrNull(form.authors),
    publisher: textOrNull(form.publisher),
    year,
    cover_url: cover,
    genre: textOrNull(form.genre),
    inventory_number: textOrNull(form.inventory_number)
  };
}

/** Převede výtisk na tvar, se kterým pracuje 3D chata a polička. */
export function itemToBook(item) {
  return {
    ...item,
    publication_date: item.year ? String(item.year) : '',
    badge: BADGES[item.status] || null
  };
}

export function matchesQuery(values, query) {
  const needle = String(query || '').trim().toLocaleLowerCase('cs');
  if (!needle) return true;
  return values.filter(Boolean).some((value) => String(value).toLocaleLowerCase('cs').includes(needle));
}

// ---------- duplicity a vydání ----------
// Řádek katalogu je jeden fyzický výtisk. Duplicita je proto další výtisk stejného
// vydání a různá vydání jedné knihy se poznají podle názvu a autora.

const fold = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('cs');

// Podtitul se nepočítá: databáze ho u stejné knihy uvádějí různě.
const titleKey = (title) =>
  fold(String(title ?? '').split(/\s*[:/=]\s/)[0])
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// „Němcová, Božena, 1820-1862“ i „Božena Němcová“ dají stejný klíč.
const authorKey = (authors) => {
  if (authors === UNKNOWN_AUTHOR) return '';
  const words = fold(authors).match(/\p{L}+/gu) || [];
  return words.sort().join(' ');
};

const isbnKey = (isbn) => {
  const code = toIsbn13(isbn);
  return code.length === 13 ? code : '';
};

const workKey = (item) => `${titleKey(item.title)}|${authorKey(item.authors)}`;

const editionKey = (item) =>
  isbnKey(item.isbn) ? `isbn:${isbnKey(item.isbn)}` : `${workKey(item)}|${item.year ?? ''}|${fold(item.publisher).trim()}`;

/** Ke každému výtisku spočítá výtisky stejného vydání a vydání stejné knihy. */
export function analyzeCatalog(items) {
  const copies = new Map();
  const editions = new Map();
  for (const item of items) {
    const edition = editionKey(item);
    copies.set(edition, (copies.get(edition) || 0) + 1);
    const work = workKey(item);
    if (!editions.has(work)) editions.set(work, new Set());
    editions.get(work).add(edition);
  }
  return new Map(
    items.map((item) => [
      item.id,
      { copies: copies.get(editionKey(item)), editions: editions.get(workKey(item)).size }
    ])
  );
}

/** Najde v katalogu výtisky podobné rozepsanému formuláři. */
export function findSimilarItems(form, items, excludeId) {
  const copies = [];
  const editions = [];
  const title = titleKey(form.title);
  const author = authorKey(form.authors);
  const isbn = isbnKey(form.isbn);
  const candidate = { ...form, year: String(form.year ?? '').trim() };

  for (const item of items) {
    if (item.id === excludeId) continue;
    const itemIsbn = isbnKey(item.isbn);
    const sameWork =
      Boolean(title) &&
      titleKey(item.title) === title &&
      (!author || !authorKey(item.authors) || authorKey(item.authors) === author);

    if (isbn && itemIsbn === isbn) copies.push(item);
    else if (!sameWork) continue;
    else if (!isbn && !itemIsbn && editionKey(item) === editionKey(candidate)) copies.push(item);
    else editions.push(item);
  }
  return { copies, editions };
}

// ---------- filtrování a řazení ----------

export const EMPTY_FILTERS = {
  query: '',
  status: '',
  genre: '',
  publisher: '',
  yearFrom: '',
  yearTo: '',
  isbn: '',
  group: ''
};

export const SORT_OPTIONS = [
  ['newest', 'Naposledy přidané'],
  ['title', 'Název A–Z'],
  ['author', 'Autor A–Z'],
  ['year', 'Rok od nejnovějšího']
];

/** Hodnoty pole seřazené pro nabídku filtru. */
export function optionsFor(items, field) {
  const values = new Set(items.map((item) => String(item[field] ?? '').trim()).filter(Boolean));
  return [...values].sort((a, b) => a.localeCompare(b, 'cs'));
}

export function filterCatalog(items, filters, groups) {
  const from = filters.yearFrom === '' ? null : Number(filters.yearFrom);
  const to = filters.yearTo === '' ? null : Number(filters.yearTo);
  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.genre && String(item.genre ?? '').trim() !== filters.genre) return false;
    if (filters.publisher && String(item.publisher ?? '').trim() !== filters.publisher) return false;
    if (from !== null && (item.year == null || item.year < from)) return false;
    if (to !== null && (item.year == null || item.year > to)) return false;
    if (filters.isbn === 'with' && !item.isbn) return false;
    if (filters.isbn === 'without' && item.isbn) return false;
    if (filters.group === 'copies' && !(groups?.get(item.id)?.copies > 1)) return false;
    if (filters.group === 'editions' && !(groups?.get(item.id)?.editions > 1)) return false;
    return matchesQuery([item.title, item.authors, item.isbn, item.inventory_number, item.genre, item.publisher], filters.query);
  });
}

export function sortCatalog(items, sort) {
  const text = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'cs');
  const compare = {
    newest: (a, b) => text(b.created_at, a.created_at),
    title: (a, b) => text(a.title, b.title),
    // Výtisky bez autora nebo roku patří na konec.
    author: (a, b) => (!a.authors - !b.authors) || text(a.authors, b.authors) || text(a.title, b.title),
    year: (a, b) => (b.year ?? -1) - (a.year ?? -1) || text(a.title, b.title)
  }[sort];
  return [...items].sort(compare);
}
