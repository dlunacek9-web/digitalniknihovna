// Helpers for lent books ("kdo mi co dluží").

export const OVERDUE_DAYS = 30;

export function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function daysSince(isoDate, today = todayIsoDate()) {
  const start = Date.parse(`${isoDate}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000));
}

export function formatLoanDate(isoDate) {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  return year && month && day ? `${day}. ${month}. ${year}` : '';
}

export function formatDays(days) {
  if (days === 0) return 'dnes';
  if (days === 1) return '1 den';
  if (days < 5) return `${days} dny`;
  return `${days} dní`;
}

// Groups lent books by borrower; the borrower with the oldest loan comes first.
export function groupLoansByBorrower(books, today = todayIsoDate()) {
  const groups = new Map();
  for (const book of books) {
    if (!book.loan?.borrower) continue;
    const key = book.loan.borrower.toLocaleLowerCase('cs');
    if (!groups.has(key)) groups.set(key, { borrower: book.loan.borrower, books: [] });
    groups.get(key).books.push({ ...book, loanDays: daysSince(book.loan.lent_at, today) });
  }

  return [...groups.values()]
    .map((group) => {
      const sortedBooks = group.books.sort((a, b) => b.loanDays - a.loanDays);
      return { ...group, books: sortedBooks, longestDays: sortedBooks[0].loanDays };
    })
    .sort((a, b) => b.longestDays - a.longestDays);
}
