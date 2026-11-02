import { describe, it, expect } from 'vitest';
import { daysSince, formatDays, formatLoanDate, groupLoansByBorrower } from './bookLoans.js';

describe('loan date helpers', () => {
  it('counts whole days between dates', () => {
    expect(daysSince('2026-10-01', '2026-11-02')).toBe(32);
    expect(daysSince('2026-11-02', '2026-11-02')).toBe(0);
    expect(daysSince('nonsense', '2026-11-02')).toBe(0);
  });

  it('formats Czech day counts and dates', () => {
    expect([0, 1, 3, 12].map(formatDays)).toEqual(['dnes', '1 den', '3 dny', '12 dní']);
    expect(formatLoanDate('2026-10-05')).toBe('5. 10. 2026');
  });
});

describe('groupLoansByBorrower', () => {
  const books = [
    { id: '1', title: 'Babička', loan: { borrower: 'Pepa', lent_at: '2026-10-20' } },
    { id: '2', title: 'Saturnin', loan: { borrower: 'Jana', lent_at: '2026-09-01' } },
    { id: '3', title: 'R.U.R.', loan: { borrower: 'pepa', lent_at: '2026-10-30' } },
    { id: '4', title: 'Nepůjčená', loan: null }
  ];

  it('groups by borrower case-insensitively and puts the oldest debt first', () => {
    const groups = groupLoansByBorrower(books, '2026-11-02');
    expect(groups.map((g) => [g.borrower, g.books.map((b) => b.title)])).toEqual([
      ['Jana', ['Saturnin']],
      ['Pepa', ['Babička', 'R.U.R.']]
    ]);
    expect(groups[0].longestDays).toBe(62);
  });

  it('returns an empty list when nothing is lent', () => {
    expect(groupLoansByBorrower([{ id: '4', loan: null }])).toEqual([]);
  });
});
