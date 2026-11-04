import { cleanIsbnDigits } from '../services/knihovnyApi';

const compact = (value) => String(value ?? '').replace(/[-\s]/g, '').trim().toUpperCase();

export function hasValidEanChecksum(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const weight = (digits.length - 1 - i) % 2 === 1 ? 3 : 1;
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

export function hasValidIsbn10Checksum(code) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const value = code[i] === 'X' ? 10 : Number(code[i]);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

/** Kód z knihy včetně EAN-8 a UPC. Kontrolní číslice zastaví rozmazané přečtení. */
export function toValidBookCode(rawText) {
  const code = compact(rawText);
  if (/^\d{13}$/.test(code) || /^\d{12}$/.test(code) || /^\d{8}$/.test(code)) {
    return hasValidEanChecksum(code) ? code : null;
  }
  if (/^\d{9}[\dX]$/.test(code)) {
    return hasValidIsbn10Checksum(code) ? code : null;
  }
  return null;
}

/** Jen skutečné ISBN: cenové a skladové kódy vedle čárového kódu se přeskočí. */
export function toValidIsbn(rawText) {
  const code = compact(rawText);
  if (/^97[89]\d{10}$/.test(code)) return hasValidEanChecksum(code) ? code : null;
  if (/^\d{9}[\dX]$/.test(code)) return hasValidIsbn10Checksum(code) ? code : null;
  return null;
}

/** Upozornění k ručně opsanému ISBN. Prázdný text znamená, že je v pořádku. */
export function isbnProblem(value) {
  const code = cleanIsbnDigits(value);
  if (!code) return '';
  if (code.length !== 10 && code.length !== 13) return 'ISBN má mít 10 nebo 13 číslic.';
  return toValidIsbn(code) ? '' : 'Kontrolní číslice nesedí, zkontroluj opsané číslo.';
}

/**
 * Najde ISBN v textu z OCR. Přednost má ISBN-13, které jde najít i uprostřed
 * delšího běhu číslic. ISBN-10 je krátké a náhodné číslo by mu mohlo vyhovět,
 * proto musí stát za slovem ISBN nebo tvořit celý běh číslic.
 */
export function extractIsbnFromText(text) {
  const upper = String(text ?? '').toUpperCase();
  let isbn10 = null;

  for (const line of upper.split(/\r?\n/)) {
    for (const run of line.match(/[\dX](?:[^\dA-Z]*[\dX])*/g) || []) {
      const code = run.replace(/[^\dX]/g, '');
      for (let i = 0; i + 13 <= code.length; i++) {
        const found = toValidIsbn(code.slice(i, i + 13));
        if (found?.length === 13) return found;
      }
      if (!isbn10 && code.length === 10) isbn10 = toValidIsbn(code);
    }
    const labelled = line.match(/ISBN[^\dX]*((?:[\dX][^\dA-Z]*){10})/);
    if (!isbn10 && labelled) isbn10 = toValidIsbn(labelled[1].replace(/[^\dX]/g, ''));
  }
  return isbn10;
}
