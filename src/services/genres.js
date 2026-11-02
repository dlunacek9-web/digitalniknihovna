/**
 * Žánry a barvy knih.
 * Knihovny.cz vrací u záznamů pole `subjects` (např. "vědecko-fantastické romány").
 * Z nich odvodíme jeden srozumitelný žánr — podle něj se v chatě automaticky
 * zakládají poličky.
 */

export const FALLBACK_GENRE = 'Ostatní';

// Pořadí je důležité: první shoda vyhrává (komiks Sapiens je komiks, ne historie).
const GENRE_RULES = [
  ['Komiks', ['komiks', 'grafick', 'manga', 'comic']],
  ['Sci-fi', ['vědecko-fantastick', 'science fiction', 'sci-fi', 'scifi']],
  ['Fantasy', ['fantasy', 'fantazy', 'fantastick']],
  ['Krimi a thrillery', ['detektiv', 'kriminál', 'thriller', 'detective', 'crime']],
  ['Horor', ['horor', 'horror']],
  ['Poezie', ['poezie', 'básn', 'verše', 'poetry', 'poems']],
  ['Pro děti', ['pro děti', 'dětsk', 'pohád', 'pro mládež', "children's", 'juvenile']],
  ['Biografie', ['biograf', 'životopis', 'memoár', 'paměti', 'autobiograf', 'biography']],
  ['Cestopisy', ['cestopis', 'cestování', 'travel']],
  ['Kuchařky', ['kuchař', 'recept', 'vaření', 'cookbook']],
  ['Psychologie', ['psycholog', 'sebepozn', 'osobní rozvoj', 'seberozvoj', 'myšlení', 'self-help']],
  ['Filozofie', ['filozof', 'filosof', 'philosophy']],
  ['Historie', ['dějin', 'histori', 'pravěk', 'středověk', 'history']],
  ['Věda a příroda', ['přírod', 'fyzik', 'biolog', 'astronom', 'vesmír', 'science']],
  ['Romány', ['román', 'povídk', 'novel', 'fiction', 'próza', 'beletrie']]
];

function flattenSubjects(subjects) {
  if (!subjects) return [];
  const list = Array.isArray(subjects) ? subjects.flat(Infinity) : [subjects];
  return list.filter(Boolean).map((s) => String(s).toLocaleLowerCase('cs'));
}

export function classifyGenre(subjects) {
  const flat = flattenSubjects(subjects);
  if (flat.length === 0) return null;

  for (const [genre, needles] of GENRE_RULES) {
    if (flat.some((subject) => needles.some((needle) => subject.includes(needle)))) {
      return genre;
    }
  }
  return null;
}

/**
 * Žánr knihy = polička, na které stojí.
 * Uložený žánr se srovná do známých poliček („Česká próza“ → „Romány“, „Fiction“ → „Romány“);
 * vlastní žánr, který žádné pravidlo nezná, zůstane, jak ho uživatel napsal.
 */
export function genreOf(book) {
  const own = String(book?.genre || '').trim();
  if (own) return classifyGenre([own]) || own;
  return classifyGenre(book?.subjects) || FALLBACK_GENRE;
}

// Severská paleta hřbetů — vlna, mech, fjord, okr…
export const SPINE_COLORS = [
  '#A8443A', '#5E6B4A', '#3E5C76', '#C9973F', '#6B4D5E', '#E9DCC3',
  '#2F2D2B', '#B5653A', '#9AAA8F', '#9DB4C0', '#23344A', '#D3A848'
];
const LIGHT_COLORS = new Set(['#E9DCC3', '#9DB4C0', '#9AAA8F', '#D3A848']);

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stabilní barva hřbetu odvozená z názvu a ISBN. */
export function bookColor(book) {
  return SPINE_COLORS[hash(`${book?.title || ''}|${book?.isbn || ''}`) % SPINE_COLORS.length];
}

export function isLightColor(color) {
  return LIGHT_COLORS.has(color);
}

/** Seskupí knihy do poliček podle žánru, v pořadí, ve kterém poličky vznikly. */
export function groupIntoShelves(books) {
  const ordered = [...books].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  );
  const shelves = new Map();
  for (const book of ordered) {
    const genre = genreOf(book);
    if (!shelves.has(genre)) shelves.set(genre, []);
    shelves.get(genre).push(book);
  }
  return [...shelves.entries()].map(([genre, items]) => ({ genre, books: items }));
}

export function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
