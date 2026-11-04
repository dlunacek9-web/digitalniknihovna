import { describe, expect, it } from 'vitest';
import { buildCatalogCsv, parseCatalogCsv, parseCsv } from './catalogCsv.js';

const ITEM = {
  title: 'Babička; "obrazy"',
  authors: 'Božena Němcová',
  isbn: '9788025704651',
  publisher: 'Odeon',
  year: 2010,
  genre: 'Romány',
  inventory_number: 'A1',
  cover_url: null,
  status: 'on_loan'
};

describe('parseCsv', () => {
  it('zná uvozovky, zdvojené uvozovky a zalomení v buňce', () => {
    expect(parseCsv('a;b\r\n"x;1";"he said ""hi"""\r\n"řádek\nzalomený";z')).toEqual([
      ['a', 'b'],
      ['x;1', 'he said "hi"'],
      ['řádek\nzalomený', 'z']
    ]);
  });

  it('pozná čárku jako oddělovač', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('export a zpětný import', () => {
  it('katalog po exportu vrátí stejné údaje', () => {
    const { rows, errors } = parseCatalogCsv(buildCatalogCsv([ITEM]));
    expect(errors).toEqual([]);
    expect(rows[0].row).toMatchObject({
      title: 'Babička; "obrazy"',
      isbn: '9788025704651',
      year: 2010,
      inventory_number: 'A1',
      cover_url: null
    });
  });

  it('text začínající = se nevyhodnotí jako vzorec a při importu se vrátí', () => {
    const csv = buildCatalogCsv([{ ...ITEM, title: '=1+1' }]);
    expect(csv).toContain("'=1+1");
    expect(parseCatalogCsv(csv).rows[0].row.title).toBe('=1+1');
  });
});

describe('parseCatalogCsv', () => {
  it('rozpozná názvy sloupců bez diakritiky a v libovolném pořadí', () => {
    const { rows } = parseCatalogCsv('autor;nazev;rok\nKarel Čapek;R.U.R.;1920');
    expect(rows[0].row).toMatchObject({ title: 'R.U.R.', authors: 'Karel Čapek', year: 1920 });
  });

  it('chybějící název a špatný rok hlásí s číslem řádku a ostatní řádky nechá projít', () => {
    const { rows, errors } = parseCatalogCsv('Název;Rok vydání\nOK;2000\n;1999\nŠpatná;abc\n\n');
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it('bez sloupce Název import odmítne', () => {
    const { rows, errors } = parseCatalogCsv('Autor;Rok\nA;1');
    expect(rows).toEqual([]);
    expect(errors[0].message).toMatch(/Název/);
  });

  it('zachytí duplicitní inventární čísla v souboru i v katalogu', () => {
    const csv = 'Název;Inventární číslo\nA;X1\nB;X1\nC;E1';
    const { rows, errors } = parseCatalogCsv(csv, [{ inventory_number: 'E1' }]);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it('ISBN poškozené Excelem označí chybou', () => {
    const { errors } = parseCatalogCsv('Název;ISBN\nA;9.79E+12');
    expect(errors[0].message).toMatch(/ISBN/);
  });

  it('prázdný soubor vrátí chybu', () => {
    expect(parseCatalogCsv('').errors).toHaveLength(1);
  });
});
