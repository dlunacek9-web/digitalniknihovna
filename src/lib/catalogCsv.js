import { formToRow } from './catalog';

// Export a import katalogu jako CSV (středník + BOM, aby ho český Excel otevřel správně).

const COLUMNS = [
  ['Název', 'title'],
  ['Autoři', 'authors'],
  ['ISBN', 'isbn'],
  ['Nakladatel', 'publisher'],
  ['Rok vydání', 'year'],
  ['Žánr', 'genre'],
  ['Inventární číslo', 'inventory_number'],
  ['Adresa obálky', 'cover_url']
];

// Při importu se rozpoznají i tyto názvy sloupců (bez diakritiky, malými písmeny).
const ALIASES = {
  title: ['nazev', 'title', 'kniha'],
  authors: ['autori', 'autor', 'authors', 'author'],
  isbn: ['isbn'],
  publisher: ['nakladatel', 'vydavatel', 'publisher'],
  year: ['rokvydani', 'rok', 'year'],
  genre: ['zanr', 'genre'],
  inventory_number: ['inventarnicislo', 'invcislo', 'inventorynumber', 'inventory'],
  cover_url: ['adresaobalky', 'obalka', 'cover', 'coverurl']
};

const STATUS_LABELS = {
  available: 'Dostupná',
  reserved: 'Rezervovaná',
  on_loan: 'Půjčená',
  unavailable: 'Vyřazená'
};

const foldKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Buňka začínající = + @ by Excel vyhodnotil jako vzorec.
const FORMULA_START = /^[=+@]/;

function escapeCsv(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[";\t\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Celý katalog jako CSV. Sloupec Stav je jen informativní, import ho ignoruje. */
export function buildCatalogCsv(items) {
  const header = [...COLUMNS.map(([name]) => name), 'Stav'].join(';');
  const rows = items.map((item) =>
    [...COLUMNS.map(([, key]) => escapeCsv(item[key])), escapeCsv(STATUS_LABELS[item.status] || '')].join(';')
  );
  return `﻿${[header, ...rows].join('\r\n')}`;
}

export function catalogCsvFileName() {
  return `katalog-${new Date().toISOString().slice(0, 10)}.csv`;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const counts = [';', '\t', ','].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}

/** Rozdělí CSV na řádky buněk. Zná uvozovky, zdvojené uvozovky i zalomení uvnitř buňky. */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const delimiter = detectDelimiter(src);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

const SCIENTIFIC = /^\d(\.\d+)?e\+\d+$/i;

/**
 * Převede CSV na řádky katalogu.
 * Vrací { rows: [{ line, row }], errors: [{ line, message }] }, kde line je číslo řádku v souboru.
 * Inventární čísla se kontrolují vůči katalogu i uvnitř souboru, protože jsou v knihovně jedinečná.
 */
export function parseCatalogCsv(text, existingItems = []) {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], errors: [{ line: 0, message: 'Soubor je prázdný.' }] };

  const header = table[0].map(foldKey);
  const columnOf = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const index = header.findIndex((name) => names.includes(name));
    if (index >= 0) columnOf[field] = index;
  }
  if (columnOf.title === undefined) {
    return { rows: [], errors: [{ line: 1, message: 'V souboru chybí sloupec „Název“.' }] };
  }

  const taken = new Set(existingItems.map((item) => item.inventory_number).filter(Boolean));
  const rows = [];
  const errors = [];

  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    if (cells.every((cell) => !cell.trim())) return;

    const form = {};
    for (const field of Object.keys(ALIASES)) {
      const raw = columnOf[field] === undefined ? '' : (cells[columnOf[field]] ?? '').trim();
      form[field] = FORMULA_START.test(raw.slice(1)) && raw.startsWith("'") ? raw.slice(1) : raw;
    }

    try {
      if (SCIENTIFIC.test(form.isbn)) {
        throw new Error('ISBN je poškozené (Excel ho převedl na vědecký zápis). Ve sloupci ISBN nastav formát Text.');
      }
      const row = formToRow(form);
      if (row.inventory_number) {
        if (taken.has(row.inventory_number)) {
          throw new Error(`Inventární číslo ${row.inventory_number} už v knihovně je.`);
        }
        taken.add(row.inventory_number);
      }
      rows.push({ line, row });
    } catch (err) {
      errors.push({ line, message: err.message });
    }
  });

  return { rows, errors };
}
