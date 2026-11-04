import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOG_FORM, formToRow, itemToBook, itemToForm, lookupToForm, matchesQuery } from './catalog.js';

describe('formToRow', () => {
  it('prázdná pole převede na null a ISBN očistí', () => {
    const row = formToRow({ ...EMPTY_CATALOG_FORM, title: '  Babička ', isbn: '978-80-257-0465-1 (brož.)', year: '1855' });
    expect(row).toEqual({
      isbn: '9788025704651',
      title: 'Babička',
      authors: null,
      publisher: null,
      year: 1855,
      cover_url: null,
      genre: null,
      inventory_number: null
    });
  });

  it('vyžaduje název', () => {
    expect(() => formToRow({ ...EMPTY_CATALOG_FORM, title: '   ' })).toThrow('Vyplň název');
  });

  it.each(['abc', '0', '2101', '19.5'])('odmítne rok %s', (year) => {
    expect(() => formToRow({ ...EMPTY_CATALOG_FORM, title: 'X', year })).toThrow('Rok vydání');
  });

  it.each(['http://x.cz/a.jpg', 'javascript:alert(1)'])('odmítne obálku %s', (cover_url) => {
    expect(() => formToRow({ ...EMPTY_CATALOG_FORM, title: 'X', cover_url })).toThrow('https://');
  });
});

describe('lookupToForm', () => {
  it('převezme údaje z vyhledání podle ISBN', () => {
    const form = lookupToForm({
      isbn: '9788025704651',
      title: 'Babička',
      authors: 'Božena Němcová',
      publisher: 'Odeon',
      publication_date: 'c2010',
      cover_url: 'https://example.test/a.jpg',
      genre: 'Romány'
    });
    expect(form).toMatchObject({ year: '2010', title: 'Babička', cover_url: 'https://example.test/a.jpg', inventory_number: '' });
  });

  it('obálku přes http zahodí a chybějící údaje nechá prázdné', () => {
    const form = lookupToForm({ title: 'X', cover_url: 'http://example.test/a.jpg', publication_date: null, genre: null });
    expect(form).toMatchObject({ cover_url: '', year: '', genre: '', isbn: '' });
  });
});

describe('itemToForm', () => {
  it('null a čísla převede na text pro pole formuláře', () => {
    const form = itemToForm({ ...EMPTY_CATALOG_FORM, title: 'X', year: 1915, genre: null });
    expect(form).toMatchObject({ title: 'X', year: '1915', genre: '' });
  });
});

describe('itemToBook', () => {
  it('označí rezervovaný a půjčený výtisk, dostupný ne', () => {
    expect(itemToBook({ status: 'reserved' }).badge).toBe('rezervováno');
    expect(itemToBook({ status: 'on_loan' }).badge).toBe('půjčeno');
    expect(itemToBook({ status: 'available' }).badge).toBeNull();
  });

  it('rok převede na tvar používaný ve scéně', () => {
    expect(itemToBook({ status: 'available', year: 1915 }).publication_date).toBe('1915');
  });
});

describe('matchesQuery', () => {
  it('hledá bez ohledu na velikost písmen a přeskakuje prázdné hodnoty', () => {
    expect(matchesQuery(['Božena Němcová', null], 'němcová')).toBe(true);
    expect(matchesQuery(['Babička'], 'krysař')).toBe(false);
  });

  it('prázdný dotaz odpovídá všemu', () => {
    expect(matchesQuery(['Babička'], '  ')).toBe(true);
  });
});
