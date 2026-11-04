import { cleanIsbnDigits } from '../services/knihovnyApi';

const BADGES = { reserved: 'rezervováno', on_loan: 'půjčeno' };

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
  return {
    ...EMPTY_CATALOG_FORM,
    isbn: book.isbn || '',
    title: book.title || '',
    authors: book.authors || '',
    publisher: book.publisher || '',
    year,
    cover_url: cover.startsWith('https://') ? cover : '',
    genre: book.genre || ''
  };
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
