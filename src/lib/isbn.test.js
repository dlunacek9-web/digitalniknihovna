import { describe, expect, it } from 'vitest';
import { extractIsbnFromText, isbnProblem, toValidBookCode, toValidIsbn } from './isbn.js';

describe('toValidIsbn', () => {
  it('přijme ISBN-13 i ISBN-10 s pomlčkami', () => {
    expect(toValidIsbn('978-80-257-0465-9')).toBeNull();
    expect(toValidIsbn('978-80-7388-054-5')).toBe('9788073880545');
    expect(toValidIsbn('80-7388-054-7')).toBe('8073880547');
    expect(toValidIsbn('0-8044-2957-x')).toBe('080442957X');
  });

  it('odmítne cenový kód, i když má platný EAN', () => {
    expect(toValidIsbn('8594001000012')).toBeNull();
    expect(toValidBookCode('8594001000012')).toBe('8594001000012');
  });
});

describe('isbnProblem', () => {
  it('prázdné pole a platné ISBN jsou v pořádku', () => {
    expect(isbnProblem('')).toBe('');
    expect(isbnProblem('978-80-7388-054-5')).toBe('');
  });

  it('upozorní na špatnou délku a kontrolní číslici', () => {
    expect(isbnProblem('12345')).toContain('10 nebo 13');
    expect(isbnProblem('9788073880544')).toContain('Kontrolní číslice');
  });
});

describe('extractIsbnFromText', () => {
  it.each([
    ['ISBN 978-80-7388-054-5', '9788073880545'],
    ['ISBN: 9788073880545\n', '9788073880545'],
    ['978 80 7388 054 5', '9788073880545'],
    ['ISBN 80-7388-054-7', '8073880547'],
    ['ISBN 0-8044-2957-X', '080442957X'],
    ['2015\nSBN 8 1 ::\nISBN 978-80-7388-054-5 2015', '9788073880545']
  ])('přečte %s', (text, expected) => {
    expect(extractIsbnFromText(text)).toBe(expected);
  });

  it('dá přednost ISBN-13 před ISBN-10', () => {
    expect(extractIsbnFromText('ISBN 80-7388-054-7\nISBN 978-80-7388-054-5')).toBe('9788073880545');
  });

  it('přečte ISBN-10 za slovem ISBN, i když za ním pokračují číslice', () => {
    expect(extractIsbnFromText('ISBN 80-7388-054-7 2003')).toBe('8073880547');
  });

  it('nepřijme špatně přečtené číslo ani náhodné číslice', () => {
    expect(extractIsbnFromText('ISBN 978-80-7388-054-4')).toBeNull();
    expect(extractIsbnFromText('12 34 2015')).toBeNull();
    expect(extractIsbnFromText('')).toBeNull();
  });
});
