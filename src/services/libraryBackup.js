// Export & import of the whole library (all libraries + books) as JSON / CSV.
// Pure helpers live here so they can be unit tested without localStorage.

export const BACKUP_FORMAT = 'digitalniknihovna-backup';
export const BACKUP_VERSION = 1;

export function buildJsonBackup({ libraries, books }) {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      libraries,
      books
    },
    null,
    2
  );
}

const CSV_COLUMNS = [
  ['Knihovna', (book, libNames) => libNames[book.library_id || 'lib_default_1'] || ''],
  ['Název', (book) => book.title],
  ['Autoři', (book) => book.authors],
  ['ISBN', (book) => book.isbn],
  ['Nakladatel', (book) => book.publisher],
  ['Rok vydání', (book) => book.publication_date],
  ['Počet stran', (book) => book.page_count],
  ['Přidáno', (book) => book.created_at]
];

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Semicolon separator + BOM so Czech Excel opens the file correctly.
export function buildCsv({ libraries, books }) {
  const libNames = Object.fromEntries(libraries.map((lib) => [lib.id, lib.name]));
  const header = CSV_COLUMNS.map(([name]) => name).join(';');
  const rows = books.map((book) =>
    CSV_COLUMNS.map(([, getValue]) => escapeCsvValue(getValue(book, libNames))).join(';')
  );
  return `﻿${[header, ...rows].join('\r\n')}`;
}

export function parseJsonBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Soubor není platný JSON.');
  }

  if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.libraries) || !Array.isArray(data.books)) {
    throw new Error('Soubor není záloha Digitální knihovny.');
  }

  return {
    libraries: data.libraries.filter((lib) => lib && lib.id && lib.name),
    books: data.books.filter((book) => book && book.title)
  };
}

export function backupFileName(extension) {
  const date = new Date().toISOString().slice(0, 10);
  return `knihovna-${date}.${extension}`;
}

export function downloadFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
