import { describe, expect, it } from 'vitest';
import { BORROWED_SHELF, reconcileBorrowedBooks } from './borrowedBooks.js';
import { genreOf } from '../services/genres.js';

const cabins = [
  { id: 'demo', demo: true },
  { id: 'a' },
  { id: 'b' }
];

const loan = (over = {}) => ({
  id: 'l1',
  status: 'approved',
  cabin_id: 'b',
  due_at: null,
  return_requested_at: null,
  catalog_items: { title: 'Babička', authors: 'Božena Němcová', year: 1855, libraries: { name: 'Školní' } },
  ...over
});

describe('reconcileBorrowedBooks', () => {
  it('schválená výpůjčka založí poličku ve zvolené chatě', () => {
    const { books, added, changed } = reconcileBorrowedBooks([], cabins, [loan()]);
    expect(changed).toBe(true);
    expect(added).toHaveLength(1);
    expect(books[0].library_id).toBe('b');
    expect(genreOf(books[0])).toBe(BORROWED_SHELF);
    expect(books[0].library_loan.library_name).toBe('Školní');
  });

  it('nevyřízená žádost do chaty nepatří', () => {
    for (const status of ['requested', 'rejected', 'cancelled', 'returned']) {
      expect(reconcileBorrowedBooks([], cabins, [loan({ status })]).books).toEqual([]);
    }
  });

  it('chybějící chata spadne do první vlastní, ne do ukázkové', () => {
    const { books } = reconcileBorrowedBooks([], cabins, [loan({ cabin_id: 'jinde' })]);
    expect(books[0].library_id).toBe('a');
  });

  it('bez vlastní chaty se kniha nepřidá', () => {
    expect(reconcileBorrowedBooks([], [cabins[0]], [loan()]).books).toEqual([]);
  });

  it('změna stavu zachová chatu, čtení i přejmenovanou poličku', () => {
    const first = reconcileBorrowedBooks([], cabins, [loan()]).books;
    const edited = [{ ...first[0], status: 'reading', genre: 'Ke čtení', library_id: 'a' }];
    const { books, added, changed } = reconcileBorrowedBooks(edited, cabins, [
      loan({ status: 'picked_up', due_at: '2026-12-01T00:00:00Z', return_requested_at: '2026-11-05T00:00:00Z' })
    ]);
    expect(changed).toBe(true);
    expect(added).toEqual([]);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({ status: 'reading', genre: 'Ke čtení', library_id: 'a', badge: 'vrací se' });
    expect(books[0].library_loan.status).toBe('picked_up');
  });

  it('vrácená kniha z chaty zmizí, ostatní zůstanou', () => {
    const own = { id: 'b_1', library_id: 'a', title: 'Moje' };
    const first = reconcileBorrowedBooks([own], cabins, [loan()]).books;
    const { books, removed } = reconcileBorrowedBooks(first, cabins, [loan({ status: 'returned' })]);
    expect(books).toEqual([own]);
    expect(removed).toHaveLength(1);
  });

  it('kniha, jejíž výpůjčka na serveru už není (smazaná knihovna), z chaty zmizí', () => {
    const own = { id: 'b_1', library_id: 'a', title: 'Moje' };
    const first = reconcileBorrowedBooks([own], cabins, [loan()]).books;
    const { books, removed, changed } = reconcileBorrowedBooks(first, cabins, []);
    expect(books).toEqual([own]);
    expect(removed).toHaveLength(1);
    expect(changed).toBe(true);
  });

  it('beze změny hlásí changed = false', () => {
    const first = reconcileBorrowedBooks([], cabins, [loan()]).books;
    expect(reconcileBorrowedBooks(first, cabins, [loan()]).changed).toBe(false);
  });
});
