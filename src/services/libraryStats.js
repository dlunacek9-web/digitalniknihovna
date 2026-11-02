// Aggregated statistics for the profile charts, computed from saved books.

const UNKNOWN_AUTHOR = 'Neznámý autor';

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name), 'cs'));
}

function parseBookYear(book) {
  const match = String(book.publication_date || '').match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : null;
}

export function splitAuthors(authors) {
  return String(authors || '')
    .split(/\s*[,;]\s*/)
    .map((name) => name.trim())
    .filter((name) => name && name !== UNKNOWN_AUTHOR);
}

export function computeLibraryStats(books, { topLimit = 5 } = {}) {
  const pageCounts = books.map((book) => Number(book.page_count) || 0).filter((pages) => pages > 0);
  const totalPages = pageCounts.reduce((sum, pages) => sum + pages, 0);

  const genreCounts = countBy(books.map((book) => String(book.genre || '').trim()).filter(Boolean));
  const otherGenresCount = genreCounts.slice(topLimit).reduce((sum, genre) => sum + genre.count, 0);
  const genres = otherGenresCount
    ? [...genreCounts.slice(0, topLimit), { name: 'Ostatní', count: otherGenresCount }]
    : genreCounts;

  const years = books.map(parseBookYear).filter(Boolean);
  const decades = countBy(years.map((year) => Math.floor(year / 10) * 10))
    .map(({ name, count }) => ({ decade: name, name: `${name}–${String(name + 9).slice(-2)}`, count }))
    .sort((a, b) => a.decade - b.decade);

  const booksWithPages = books.filter((book) => Number(book.page_count) > 0);
  const byPages = [...booksWithPages].sort((a, b) => Number(b.page_count) - Number(a.page_count));
  const booksWithYear = books.filter((book) => parseBookYear(book));
  const oldestBook = booksWithYear.length
    ? booksWithYear.reduce((oldest, book) => (parseBookYear(book) < parseBookYear(oldest) ? book : oldest))
    : null;

  const authorCounts = countBy(books.flatMap((book) => splitAuthors(book.authors)));

  return {
    totalBooks: books.length,
    totalPages,
    averagePages: pageCounts.length ? Math.round(totalPages / pageCounts.length) : 0,
    authorCount: authorCounts.length,
    topAuthors: authorCounts.slice(0, topLimit),
    genres,
    genreCount: genreCounts.length,
    booksWithoutGenre: books.length - books.filter((book) => String(book.genre || '').trim()).length,
    decades,
    longestBook: byPages[0] || null,
    shortestBook: byPages.length > 1 ? byPages[byPages.length - 1] : null,
    oldestBook
  };
}
