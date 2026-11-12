import { describe, it, expect } from 'vitest';
import { buildJsonBackup, buildCsv, parseJsonBackup } from './libraryBackup.js';

const SAMPLE_DATA = {
  libraries: [{ id: 'lib_default_1', name: 'Knihovna 1' }],
  books: [
    {
      id: 'b_1',
      library_id: 'lib_default_1',
      title: 'Babička; "Obrazy venkovského života"',
      authors: 'Božena Němcová',
      isbn: '9788024300000',
      publisher: 'Argo',
      publication_date: 2015,
      page_count: 320,
      created_at: '2026-10-01T10:00:00.000Z'
    }
  ]
};

describe('JSON backup', () => {
  it('round-trips libraries and books', () => {
    const parsed = parseJsonBackup(buildJsonBackup(SAMPLE_DATA));
    expect(parsed.libraries).toEqual(SAMPLE_DATA.libraries);
    expect(parsed.books).toEqual(SAMPLE_DATA.books);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseJsonBackup('{oops')).toThrow('Soubor není platný JSON.');
  });

  it('rejects JSON that is not a library backup', () => {
    expect(() => parseJsonBackup('{"books": []}')).toThrow('Soubor není záloha z Lukutupy.');
  });
});

describe('CSV export', () => {
  it('writes header, library name and escapes special characters', () => {
    const csv = buildCsv(SAMPLE_DATA);
    const [header, row] = csv.replace('﻿', '').split('\r\n');
    expect(header).toBe('Knihovna;Název;Autoři;ISBN;Nakladatel;Rok vydání;Počet stran;Přidáno');
    expect(row).toBe(
      'Knihovna 1;"Babička; ""Obrazy venkovského života""";Božena Němcová;9788024300000;Argo;2015;320;2026-10-01T10:00:00.000Z'
    );
  });
});
