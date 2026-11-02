import { describe, it, expect } from 'vitest';
import { computeLibraryStats, splitAuthors } from './libraryStats.js';

const BOOKS = [
  { title: 'Babička', authors: 'Božena Němcová', genre: 'Česká próza', publication_date: '1855', page_count: 320 },
  { title: 'Divá Bára', authors: 'Božena Němcová', genre: 'Česká próza', publication_date: '1856', page_count: 80 },
  { title: 'Dobrý voják Švejk', authors: 'Jaroslav Hašek', genre: 'Humor', publication_date: '2011', page_count: 750 },
  { title: 'Bez údajů', authors: 'Neznámý autor' }
];

describe('splitAuthors', () => {
  it('splits multiple authors and drops the unknown placeholder', () => {
    expect(splitAuthors('Terry Pratchett, Neil Gaiman')).toEqual(['Terry Pratchett', 'Neil Gaiman']);
    expect(splitAuthors('Neznámý autor')).toEqual([]);
  });
});

describe('computeLibraryStats', () => {
  const stats = computeLibraryStats(BOOKS);

  it('counts totals and average pages over books with known page count', () => {
    expect(stats.totalBooks).toBe(4);
    expect(stats.totalPages).toBe(1150);
    expect(stats.averagePages).toBe(383);
    expect(stats.authorCount).toBe(2);
  });

  it('ranks top authors and genres', () => {
    expect(stats.topAuthors).toEqual([
      { name: 'Božena Němcová', count: 2 },
      { name: 'Jaroslav Hašek', count: 1 }
    ]);
    expect(stats.genres[0]).toEqual({ name: 'Česká próza', count: 2 });
    expect(stats.booksWithoutGenre).toBe(1);
  });

  it('groups publication years by decade in chronological order', () => {
    expect(stats.decades.map((d) => [d.name, d.count])).toEqual([['1850–59', 2], ['2010–19', 1]]);
  });

  it('finds the longest, shortest and oldest book', () => {
    expect(stats.longestBook.title).toBe('Dobrý voják Švejk');
    expect(stats.shortestBook.title).toBe('Divá Bára');
    expect(stats.oldestBook.title).toBe('Babička');
  });

  it('orders decades with equal counts without crashing', () => {
    const tied = computeLibraryStats([{ publication_date: '2001' }, { publication_date: '1990' }]);
    expect(tied.decades.map((d) => d.name)).toEqual(['1990–99', '2000–09']);
  });

  it('handles an empty library', () => {
    const empty = computeLibraryStats([]);
    expect(empty.longestBook).toBeNull();
    expect(empty.decades).toEqual([]);
    expect(empty.averagePages).toBe(0);
  });
});
