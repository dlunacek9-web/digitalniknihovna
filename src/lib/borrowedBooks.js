export const BORROWED_SHELF = 'Vypůjčené knihy';

const SHELVED_STATUSES = ['approved', 'picked_up'];

function loanBadge(loan) {
  if (loan.return_requested_at) return 'vrací se';
  return loan.status === 'approved' ? 'k vyzvednutí' : 'vypůjčeno';
}

function loanSnapshot(loan) {
  return {
    id: loan.id,
    status: loan.status,
    due_at: loan.due_at ?? null,
    return_requested_at: loan.return_requested_at ?? null,
    library_name: loan.catalog_items?.libraries?.name ?? ''
  };
}

function loanToBook(loan, cabinId, now) {
  const item = loan.catalog_items ?? {};
  return {
    id: `loan_${loan.id}`,
    library_id: cabinId,
    title: item.title ?? '',
    authors: item.authors || 'Neznámý autor',
    isbn: item.isbn ?? '',
    publisher: item.publisher ?? '',
    publication_date: item.year ? String(item.year) : '',
    cover_url: item.cover_url ?? '',
    genre: BORROWED_SHELF,
    genre_locked: true,
    badge: loanBadge(loan),
    library_loan: loanSnapshot(loan),
    created_at: now
  };
}

/**
 * Srovná knihy v chatách s výpůjčkami čtenáře. Schválená výpůjčka přidá knihu do zvolené
 * chaty a vyřízená ji odebere. Polička vznikne a zmizí sama, protože se odvozuje z knih.
 * Výpůjčka, která v seznamu není, patří jinému účtu v tomto prohlížeči, a zůstává.
 */
export function reconcileBorrowedBooks(books, cabins, loans, now = new Date().toISOString()) {
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const removed = [];
  const shelved = new Set();

  const next = books.flatMap((book) => {
    const loan = book.library_loan && loansById.get(book.library_loan.id);
    if (!loan) return [book];
    if (!SHELVED_STATUSES.includes(loan.status)) {
      removed.push(book);
      return [];
    }
    shelved.add(loan.id);
    return [{ ...book, badge: loanBadge(loan), library_loan: loanSnapshot(loan) }];
  });

  const added = [];
  const ownCabins = cabins.filter((cabin) => !cabin.demo);
  for (const loan of loans) {
    if (!SHELVED_STATUSES.includes(loan.status) || shelved.has(loan.id)) continue;
    // Zvolená chata tu nemusí být (jiný prohlížeč, smazaná chata), kniha se ale nesmí ztratit.
    const cabin = ownCabins.find((c) => c.id === loan.cabin_id) ?? ownCabins[0];
    if (cabin) added.push(loanToBook(loan, cabin.id, now));
  }

  const result = [...added, ...next];
  return { books: result, added, removed, changed: JSON.stringify(result) !== JSON.stringify(books) };
}
