import React from 'react';

export const EMPTY_BOOK_FIELDS = {
  title: '',
  authors: '',
  isbn: '',
  publisher: '',
  publication_date: '',
  page_count: '',
  cover_url: ''
};

/** Předvyplní pole z uložené knihy. */
export function bookToFields(book) {
  return {
    title: book.title || '',
    authors: book.authors && book.authors !== 'Neznámý autor' ? book.authors : '',
    isbn: book.isbn || '',
    publisher: book.publisher || '',
    publication_date: book.publication_date ? String(book.publication_date) : '',
    page_count: book.page_count ? String(book.page_count) : '',
    cover_url: book.cover_url || ''
  };
}

/** Vrátí českou chybu, nebo prázdný řetězec, když jsou údaje v pořádku. */
export function validateBookFields(fields) {
  if (!fields.title.trim()) return 'Vyplň název knihy.';
  const isbn = fields.isbn.replace(/[-\s]/g, '');
  if (isbn && !/^(?:\d{9}[\dXx]|\d{13})$/.test(isbn)) return 'ISBN má mít 10 nebo 13 číslic. Když ho nevíš, nech pole prázdné.';
  const year = fields.publication_date.trim();
  if (year && !/^-?\d{1,4}$/.test(year)) return 'Rok vydání zadej číslem, např. 2020.';
  const pages = fields.page_count.trim();
  if (pages && !(Number.parseInt(pages, 10) > 0)) return 'Počet stran musí být kladné číslo.';
  // Jen https: obálka se načítá do stránky i do 3D scény.
  const cover = fields.cover_url.trim();
  if (cover && !/^https:\/\/\S+$/i.test(cover)) return 'Adresa obálky musí začínat https://';
  return '';
}

const FIELDS = [
  ['title', 'Název', 'Např. Babička', { required: true, wide: true }],
  ['authors', 'Autor', 'Např. Božena Němcová', { wide: true }],
  ['publisher', 'Nakladatel', 'Např. Albatros'],
  ['publication_date', 'Rok vydání', 'Např. 2020', { inputMode: 'numeric' }],
  ['page_count', 'Počet stran', 'Např. 250', { inputMode: 'numeric' }],
  ['isbn', 'ISBN', 'Nepovinné', { inputMode: 'numeric' }],
  ['cover_url', 'Adresa obálky', 'https://…', { wide: true, type: 'url' }]
];

/** Pole s údaji knihy ve stylu chaty. Sdílí je ruční přidání i úprava knihy. */
export default function BookFields({ value, onChange }) {
  return (
    <div className="book-form">
      {FIELDS.map(([key, label, placeholder, opts = {}]) => (
        <label key={key} className={opts.wide ? 'is-wide' : ''}>
          <span className="eyebrow">
            {label}
            {opts.required && ' *'}
          </span>
          <input
            type={opts.type || 'text'}
            inputMode={opts.inputMode}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            placeholder={placeholder}
            required={opts.required}
            autoComplete="off"
          />
        </label>
      ))}
    </div>
  );
}
