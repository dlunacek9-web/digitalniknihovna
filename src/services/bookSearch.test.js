import { describe, it, expect } from 'vitest';
import { mergeResults, normalizeGoogleItem, normalizeOpenLibraryDoc } from './bookSearch.js';

describe('bookSearch', () => {
  it('normalizeGoogleItem maps volumeInfo and prefers ISBN-13', () => {
    const book = normalizeGoogleItem({
      volumeInfo: {
        title: 'Hobit',
        authors: ['J. R. R. Tolkien'],
        publishedDate: '1937-09-21',
        industryIdentifiers: [
          { type: 'ISBN_10', identifier: '0261102214' },
          { type: 'ISBN_13', identifier: '9780261102217' }
        ],
        imageLinks: { thumbnail: 'http://books.google.com/x.jpg' }
      }
    });
    expect(book.isbn).toBe('9780261102217');
    expect(book.publication_date).toBe('1937');
    expect(book.cover_url).toBe('https://books.google.com/x.jpg');
    expect(normalizeGoogleItem({ volumeInfo: {} })).toBeNull();
  });

  it('normalizeOpenLibraryDoc picks a 13-digit ISBN and cover', () => {
    const book = normalizeOpenLibraryDoc({ title: 'Dune', author_name: ['Frank Herbert'], isbn: ['0441172717', '9780441172719'], cover_i: 42 });
    expect(book.isbn).toBe('9780441172719');
    expect(book.cover_url).toContain('/42-L.jpg');
  });

  it('mergeResults dedupes by ISBN and fills missing fields', () => {
    const a = [{ isbn: '1', title: 'A', authors: 'x', cover_url: null }];
    const b = [{ isbn: '1', title: 'A', authors: 'x', cover_url: 'c.jpg' }, { isbn: '', title: 'B', authors: 'y' }];
    const merged = mergeResults([a, b]);
    expect(merged).toHaveLength(2);
    expect(merged[0].cover_url).toBe('c.jpg');
  });
});
