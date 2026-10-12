import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanIsbnDigits,
  toIsbn13,
  cleanCatalogText,
  parseYear,
  cleanAuthorName,
  parseAuthors,
  parsePageCount,
  normalizeRecord,
  searchKnihovnyApi,
  lookupByIsbn,
  REQUESTED_FIELDS,
  KNIHOVNY_API_URL
} from './knihovnyApi.js';

// Sample API response from prompt
const SAMPLE_API_RESPONSE = {
  resultCount: 1,
  records: [
    {
      id: 'mkp.3521868',
      title: 'Životy slavných a starých provensálských básníků, kteří žili v dobách hrabat z kraje Provença',
      authors: {
        primary: { 'Jean de Nostredame, asi 1507-1577': [] },
        secondary: { 'Josef Prokop, 1971-': [], 'Vojtěch Domlátil, 1979-': [] },
        corporate: []
      },
      publishers: ['Argo,'],
      placesOfPublication: ['Praha :'],
      publicationDates: ['2011'],
      physicalDescriptions: ['218 s. : il. ; 22 cm'],
      isbns: ['978-80-257-0367-0'],
      issns: [],
      cnb: 'cnb002163342',
      formats: ['0/BOOKS/']
    }
  ],
  status: 'OK'
};

describe('knihovnyApi service', () => {
  describe('ISBN utility functions', () => {
    it('cleanIsbnDigits strips hyphens, spaces, and notes', () => {
      expect(cleanIsbnDigits('978-80-257-0367-0')).toBe('9788025703670');
      expect(cleanIsbnDigits('80-202-0468-7 (brož.)')).toBe('8020204687');
      expect(cleanIsbnDigits(' 80 202 0468 7 ')).toBe('8020204687');
    });

    it('toIsbn13 converts ISBN-10 to ISBN-13 with calculated check digit', () => {
      // 80-257-0367-0 or similar ISBN-10
      // For 802570367x:
      // 978 + 802570367 = 978802570367
      // sum: 9*1 + 7*3 + 8*1 + 8*3 + 0*1 + 2*3 + 5*1 + 7*3 + 0*1 + 3*3 + 6*1 + 7*3 = 9+21+8+24+0+6+5+21+0+9+6+21 = 130 % 10 = 0 -> check digit 0 -> 9788025703670
      expect(toIsbn13('80-257-0367-X')).toBe('9788025703670');
      expect(toIsbn13('978-80-257-0367-0')).toBe('9788025703670');
    });
  });

  describe('Catalog text & field cleaning', () => {
    it('cleanCatalogText strips trailing catalog punctuation', () => {
      expect(cleanCatalogText('Argo,')).toBe('Argo');
      expect(cleanCatalogText('Praha :')).toBe('Praha');
      expect(cleanCatalogText('[Praha] :')).toBe('Praha');
      expect(cleanCatalogText('Nakladatelství /')).toBe('Nakladatelství');
    });

    it('parseYear extracts 4-digit year', () => {
      expect(parseYear(['2011'])).toBe('2011');
      expect(parseYear(['c2010'])).toBe('2010');
      expect(parseYear(['[2025]'])).toBe('2025');
      expect(parseYear(null)).toBe('');
    });

    it('cleanAuthorName removes trailing birth/death years', () => {
      expect(cleanAuthorName('Jean de Nostredame, asi 1507-1577')).toBe('Jean de Nostredame');
      expect(cleanAuthorName('Josef Prokop, 1971-')).toBe('Josef Prokop');
      expect(cleanAuthorName('Vojtěch Domlátil, 1979-')).toBe('Vojtěch Domlátil');
      expect(cleanAuthorName('Karel Čapek')).toBe('Karel Čapek');
    });

    it('parseAuthors formats authors from object keys', () => {
      const authors = parseAuthors(SAMPLE_API_RESPONSE.records[0].authors);
      expect(authors).toBe('Jean de Nostredame');
    });

    it('parsePageCount extracts page numbers from physicalDescriptions', () => {
      expect(parsePageCount(['218 s. : il. ; 22 cm'])).toBe(218);
      expect(parsePageCount(['260 stran'])).toBe(260);
      expect(parsePageCount(null)).toBeNull();
    });
  });

  describe('normalizeRecord', () => {
    it('correctly normalizes Knihovny.cz record format', () => {
      const rawRecord = SAMPLE_API_RESPONSE.records[0];
      const normalized = normalizeRecord(rawRecord);

      expect(normalized).toEqual({
        id: 'mkp.3521868',
        isbn: '9788025703670',
        title: 'Životy slavných a starých provensálských básníků, kteří žili v dobách hrabat z kraje Provença',
        authors: 'Jean de Nostredame',
        publisher: 'Argo',
        publication_date: '2011',
        page_count: 218,
        description: '',
        cover_url: null,
        cnb: 'cnb002163342',
        formats: ['0/BOOKS/'],
        rawIsbns: ['978-80-257-0367-0']
      });
    });
  });

  describe('searchKnihovnyApi & lookupByIsbn API interaction', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('searchKnihovnyApi constructs correct query string with field[] parameters', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_API_RESPONSE
      });

      const records = await searchKnihovnyApi({
        lookfor: '9788025703670',
        type: 'ISN',
        limit: 10
      });

      expect(records).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const calledUrl = fetchSpy.mock.calls[0][0];
      expect(calledUrl).toContain('https://www.knihovny.cz/api/v1/search?');
      expect(calledUrl).toContain('lookfor=9788025703670');
      expect(calledUrl).toContain('type=ISN');
      expect(calledUrl).toContain('limit=10');

      for (const field of REQUESTED_FIELDS) {
        expect(calledUrl).toContain(`field%5B%5D=${field}`);
      }
    });

    it('searchKnihovnyApi handles zero results without records field safely', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ resultCount: 0, status: 'OK' })
      });

      const records = await searchKnihovnyApi({
        lookfor: 'nonexistent',
        type: 'Title'
      });

      expect(records).toEqual([]);
    });

    it('lookupByIsbn successfully finds matching book by ISBN', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_API_RESPONSE
      });

      const result = await lookupByIsbn('978-80-257-0367-0');
      expect(result.success).toBe(true);
      expect(result.book.title).toBe(
        'Životy slavných a starých provensálských básníků, kteří žili v dobách hrabat z kraje Provença'
      );
      expect(result.book.authors).toBe('Jean de Nostredame');
      expect(result.book.publisher).toBe('Argo');
      expect(result.book.publication_date).toBe('2011');
      expect(result.book.page_count).toBe(218);
      expect(result.book.cnb).toBe('cnb002163342');
    });

    it('lookupByIsbn returns error when no record in search results matches target ISBN', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_API_RESPONSE
      });

      // Query for an ISBN that does not match the sample response's 9788025703670
      const result = await lookupByIsbn('978-80-000-0000-0');
      expect(result.success).toBe(false);
      expect(result.error).toContain('nebyla v katalogu Knihovny.cz nalezena');
    });
  });
});
