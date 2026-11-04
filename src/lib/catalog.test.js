import { describe, expect, it } from 'vitest';
import {
  analyzeCatalog,
  applyBookToForm,
  copyPreset,
  editionPreset,
  EMPTY_CATALOG_FORM,
  EMPTY_FILTERS,
  filterCatalog,
  findSimilarItems,
  formToRow,
  itemToBook,
  itemToForm,
  lookupToForm,
  matchesQuery,
  optionsFor,
  sortCatalog
} from './catalog.js';

const BABICKA_ODEON = { id: 'a', title: 'Babička', authors: 'Božena Němcová', isbn: '9788025704651', publisher: 'Odeon', year: 2010, genre: 'Romány', status: 'available', created_at: '2026-01-01', inventory_number: 'A1' };
const BABICKA_ODEON_2 = { ...BABICKA_ODEON, id: 'b', inventory_number: 'A2', created_at: '2026-01-02' };
const BABICKA_OLD = { id: 'c', title: 'Babička : obrazy venkovského života', authors: 'Němcová, Božena, 1820-1862', isbn: null, publisher: 'Albatros', year: 1975, genre: 'Romány', status: 'unavailable', created_at: '2026-01-03' };
const KRYSAR = { id: 'd', title: 'Krysař', authors: null, isbn: null, publisher: null, year: null, genre: null, status: 'on_loan', created_at: '2026-01-04' };
const ITEMS = [BABICKA_ODEON, BABICKA_ODEON_2, BABICKA_OLD, KRYSAR];

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

describe('lookupToForm a dlouhé záznamy', () => {
  it('nepřevezme zástupného autora a ořízne údaje na limity databáze', () => {
    const form = lookupToForm({ title: 'X', authors: 'Neznámý autor', genre: 'g'.repeat(150) });
    expect(form.authors).toBe('');
    expect(form.genre).toHaveLength(100);
  });
});

describe('applyBookToForm', () => {
  it('přepíše údaje nalezené knihy, ostatní nechá podle formuláře', () => {
    const form = { ...EMPTY_CATALOG_FORM, title: 'Babič', publisher: 'Můj nakladatel', inventory_number: 'A7' };
    const next = applyBookToForm(form, { title: 'Babička', authors: 'Božena Němcová', isbn: '9788025704651' });
    expect(next).toMatchObject({
      title: 'Babička',
      authors: 'Božena Němcová',
      isbn: '9788025704651',
      publisher: 'Můj nakladatel',
      inventory_number: 'A7'
    });
  });
});

describe('předvyplnění výtisku a vydání', () => {
  it('další výtisk převezme vše kromě inventárního čísla', () => {
    expect(copyPreset(BABICKA_ODEON)).toMatchObject({ title: 'Babička', isbn: '9788025704651', year: '2010', inventory_number: '' });
  });

  it('jiné vydání převezme jen název, autora a žánr', () => {
    expect(editionPreset(BABICKA_ODEON)).toEqual({
      ...EMPTY_CATALOG_FORM,
      title: 'Babička',
      authors: 'Božena Němcová',
      genre: 'Romány'
    });
  });
});

describe('analyzeCatalog', () => {
  it('spočítá výtisky vydání a vydání knihy i přes jiný zápis autora a podtitul', () => {
    const groups = analyzeCatalog(ITEMS);
    expect(groups.get('a')).toEqual({ copies: 2, editions: 2 });
    expect(groups.get('c')).toEqual({ copies: 1, editions: 2 });
    expect(groups.get('d')).toEqual({ copies: 1, editions: 1 });
  });

  it('ISBN-10 a ISBN-13 stejné knihy jsou jedno vydání', () => {
    const groups = analyzeCatalog([
      { id: '1', title: 'X', isbn: '8073880547' },
      { id: '2', title: 'X', isbn: '9788073880545' }
    ]);
    expect(groups.get('1').copies).toBe(2);
  });
});

describe('findSimilarItems', () => {
  const form = (values) => ({ ...EMPTY_CATALOG_FORM, ...values });

  it('stejné ISBN je další výtisk', () => {
    const { copies, editions } = findSimilarItems(form({ isbn: '978-80-257-0465-1' }), ITEMS);
    expect(copies.map((i) => i.id)).toEqual(['a', 'b']);
    expect(editions).toEqual([]);
  });

  it('stejná kniha s jiným ISBN je jiné vydání', () => {
    const { copies, editions } = findSimilarItems(form({ title: 'babička', isbn: '9788073880545' }), ITEMS);
    expect(copies).toEqual([]);
    expect(editions.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('kniha bez ISBN se shoduje podle názvu, autora, roku a nakladatele', () => {
    const { copies } = findSimilarItems(
      form({ title: 'Babička', authors: 'Božena Němcová', publisher: 'Albatros', year: '1975' }),
      ITEMS
    );
    expect(copies.map((i) => i.id)).toEqual(['c']);
  });

  it('nepovažuje knihu jiného autora za stejnou a vynechá upravovaný výtisk', () => {
    expect(findSimilarItems(form({ title: 'Babička', authors: 'Jan Novák' }), ITEMS).editions).toEqual([]);
    expect(findSimilarItems(form({ isbn: '9788025704651' }), ITEMS, 'a').copies.map((i) => i.id)).toEqual(['b']);
  });

  it('prázdný formulář nic nenajde', () => {
    expect(findSimilarItems(form({}), ITEMS)).toEqual({ copies: [], editions: [] });
  });
});

describe('filterCatalog', () => {
  const ids = (filters) =>
    filterCatalog(ITEMS, { ...EMPTY_FILTERS, ...filters }, analyzeCatalog(ITEMS)).map((i) => i.id);

  it('bez filtrů vrátí vše', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd']);
  });

  it.each([
    [{ status: 'on_loan' }, ['d']],
    [{ genre: 'Romány' }, ['a', 'b', 'c']],
    [{ publisher: 'Albatros' }, ['c']],
    [{ yearFrom: '2000' }, ['a', 'b']],
    [{ yearTo: '2000' }, ['c']],
    [{ isbn: 'with' }, ['a', 'b']],
    [{ isbn: 'without' }, ['c', 'd']],
    [{ group: 'copies' }, ['a', 'b']],
    [{ group: 'editions' }, ['a', 'b', 'c']],
    [{ query: 'krysař' }, ['d']],
    [{ genre: 'Romány', yearTo: '2000' }, ['c']]
  ])('%o', (filters, expected) => {
    expect(ids(filters)).toEqual(expected);
  });
});

describe('sortCatalog', () => {
  const ids = (sort) => sortCatalog(ITEMS, sort).map((i) => i.id);

  it('řadí od nejnovějšího přidání', () => {
    expect(ids('newest')).toEqual(['d', 'c', 'b', 'a']);
  });

  it('podle autora dá výtisky bez autora na konec', () => {
    expect(ids('author').at(-1)).toBe('d');
  });

  it('podle roku dá výtisky bez roku na konec', () => {
    expect(ids('year').slice(-2)).toEqual(['c', 'd']);
  });

  it('nemění původní pole', () => {
    const before = [...ITEMS];
    sortCatalog(ITEMS, 'title');
    expect(ITEMS).toEqual(before);
  });
});

describe('optionsFor', () => {
  it('vrátí neprázdné hodnoty bez duplicit a seřazené', () => {
    expect(optionsFor(ITEMS, 'publisher')).toEqual(['Albatros', 'Odeon']);
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
