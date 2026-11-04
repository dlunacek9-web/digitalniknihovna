// Osobní chaty a knihy čtenáře. Zdroj pravdy je databáze (tabulky cabins a cabin_books),
// v paměti je jen kopie po přihlášení, aby čtení zůstalo synchronní. Žádná data se
// neukládají do prohlížeče; ukázková chata je jen v paměti.
import { supabase } from '../lib/supabase';
import { unwrap } from '../lib/errors';
import { cleanIsbnDigits } from './knihovnyApi';
import { genreOf } from './genres';
import { buildDemoLibrary, DEMO_LIBRARY_ID } from './demoLibrary';
import { reconcileBorrowedBooks } from '../lib/borrowedBooks';

const PAGE_SIZE = 1000;
const DEFAULT_CABIN_NAME = 'Knihovna 1';

// Klíče z dřívějška, kdy se vše ukládalo do prohlížeče. Zbytek se po přihlášení přenese do účtu.
const LEGACY_KEYS = {
  books: 'digitalniknihovna.books.v2',
  libraries: 'digitalniknihovna.libraries.v2',
  active: 'digitalniknihovna.active_lib.v2',
  keepScanning: 'digitalniknihovna.keep_scanning.v1',
  tutorial: 'digitalniknihovna.tutorial.v2',
  staffLibrary: 'digitalniknihovna.staff_library.v1'
};

let state = emptyState();
// Zápisy běží po jednom, aby se souběžné změny nepřepisovaly.
let queue = Promise.resolve();

function emptyState() {
  return { userId: null, cabins: [], books: [], settings: {}, demoBooks: [], demoLibrary: null };
}

function serialize(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

const NON_DATA_FIELDS = new Set(['id', 'library_id', 'title', 'authors', 'isbn', 'created_at', 'demo']);

function bookToRow(book, cabinId) {
  const data = {};
  for (const [key, value] of Object.entries(book)) {
    if (!NON_DATA_FIELDS.has(key) && value !== undefined) data[key] = value;
  }
  return {
    cabin_id: cabinId,
    user_id: state.userId,
    title: String(book.title || '').trim(),
    authors: book.authors ?? null,
    isbn: book.isbn ?? '',
    data
  };
}

function rowToBook(row) {
  return {
    ...row.data,
    id: row.id,
    library_id: row.cabin_id,
    title: row.title,
    authors: row.authors ?? '',
    isbn: row.isbn ?? '',
    created_at: row.created_at
  };
}

const isDemoBook = (book) => Boolean(book?.demo);
const isDemoLibraryId = (id) => id === DEMO_LIBRARY_ID;

function allBooks() {
  return [...state.books, ...state.demoBooks];
}

function allLibraries() {
  return state.demoLibrary ? [state.demoLibrary, ...state.cabins] : [...state.cabins];
}

// ---------- nastavení účtu ----------

export function getSetting(key, fallback = null) {
  return state.settings[key] ?? fallback;
}

export async function saveSettings(patch) {
  if (!state.userId) return;
  const next = { ...state.settings, ...patch };
  for (const key of Object.keys(next)) if (next[key] === null) delete next[key];
  state.settings = next;
  unwrap(await supabase.from('profiles').update({ settings: next }).eq('id', state.userId));
}

// ---------- načtení ----------

async function fetchAllBooks() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = unwrap(
      await supabase
        .from('cabin_books')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE_SIZE - 1)
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function readLegacy() {
  try {
    const parse = (key, fallback) => JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    const libraries = parse(LEGACY_KEYS.libraries, []);
    const books = parse(LEGACY_KEYS.books, []);
    const has = Object.values(LEGACY_KEYS).some((key) => localStorage.getItem(key) !== null);
    return {
      has,
      libraries: Array.isArray(libraries) ? libraries : [],
      books: Array.isArray(books) ? books : [],
      keepScanning: localStorage.getItem(LEGACY_KEYS.keepScanning) === '1'
    };
  } catch {
    return { has: false, libraries: [], books: [], keepScanning: false };
  }
}

function clearLegacy() {
  try {
    for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key);
  } catch {
    // nic dalšího se nedá dělat
  }
}

// Přenese data z dřívějšího ukládání v prohlížeči do účtu a smaže je.
async function migrateLegacy() {
  const legacy = readLegacy();
  if (!legacy.has) return;

  const ownLibraries = legacy.libraries.filter((lib) => lib && lib.id && !lib.demo && lib.id !== DEMO_LIBRARY_ID);
  const ownBooks = legacy.books.filter((book) => book && book.title && !book.demo);
  const defaultId = ownLibraries[0]?.id ?? 'lib_default_1';
  const counts = new Map();
  for (const book of ownBooks) {
    const id = book.library_id || defaultId;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const toCreate = ownLibraries.filter((lib) => counts.get(lib.id) || lib.name !== DEFAULT_CABIN_NAME);
  if (counts.get('lib_default_1') && !ownLibraries.some((lib) => lib.id === 'lib_default_1')) {
    toCreate.push({ id: 'lib_default_1', name: DEFAULT_CABIN_NAME });
  }

  const idMap = new Map();
  if (toCreate.length) {
    const created = unwrap(
      await supabase
        .from('cabins')
        .insert(toCreate.map((lib) => ({ user_id: state.userId, name: String(lib.name).trim().slice(0, 200) || 'Knihovna' })))
        .select()
    );
    toCreate.forEach((lib, index) => idMap.set(lib.id, created[index]));
    state.cabins.push(...created);
  }

  const rows = ownBooks
    .filter((book) => idMap.has(book.library_id || defaultId))
    .map((book) => ({
      ...bookToRow(book, idMap.get(book.library_id || defaultId).id),
      created_at: book.created_at || new Date().toISOString()
    }));
  for (let i = 0; i < rows.length; i += 200) {
    const saved = unwrap(await supabase.from('cabin_books').insert(rows.slice(i, i + 200)).select());
    state.books.push(...saved.map(rowToBook));
  }

  const patch = {};
  if (legacy.keepScanning) patch.keep_scanning = true;
  if (Object.keys(patch).length) await saveSettings(patch);
  clearLegacy();
}

/** Načte chaty a knihy přihlášeného uživatele. Volá se jednou po přihlášení. */
export async function loadLibraryStore(userId) {
  state = { ...emptyState(), userId };

  const profile = unwrap(await supabase.from('profiles').select('settings').eq('id', userId).single());
  state.settings = profile?.settings ?? {};
  state.cabins = unwrap(await supabase.from('cabins').select('*').order('created_at').order('id'));
  state.books = (await fetchAllBooks()).map(rowToBook);

  try {
    await migrateLegacy();
  } catch (err) {
    // Stará data zůstanou v prohlížeči a přenos se zkusí příště.
    console.error('Legacy data migration failed:', err);
  }

  if (state.cabins.length === 0) {
    const [created] = unwrap(
      await supabase.from('cabins').insert({ user_id: userId, name: DEFAULT_CABIN_NAME }).select()
    );
    state.cabins.push(created);
  }

  if (!state.settings.demo_hidden) {
    const demo = buildDemoLibrary();
    state.demoLibrary = demo.library;
    state.demoBooks = demo.books;
    // Nový uživatel začíná v ukázkové chatě, ať vidí, co aplikace umí.
    if (!state.settings.active_cabin) state.settings.active_cabin = DEMO_LIBRARY_ID;
  }
}

export function resetLibraryStore() {
  state = emptyState();
}

// ---------- chaty ----------

export function getLibraries() {
  return allLibraries();
}

export function getActiveLibraryId() {
  const libraries = allLibraries();
  const saved = state.settings.active_cabin;
  if (saved && libraries.some((lib) => lib.id === saved)) return saved;
  return (libraries.find((lib) => !lib.demo) ?? libraries[0])?.id ?? null;
}

export function setActiveLibraryId(id) {
  state.settings = { ...state.settings, active_cabin: id || undefined };
  saveSettings({ active_cabin: id || null }).catch((err) => console.error('Saving active cabin failed:', err));
}

export function addLibrary(name) {
  return serialize(async () => {
    const trimmed = String(name || '').trim() || 'Nová knihovna';
    const [created] = unwrap(
      await supabase.from('cabins').insert({ user_id: state.userId, name: trimmed.slice(0, 200) }).select()
    );
    state.cabins.push(created);
    setActiveLibraryId(created.id);
    return created;
  });
}

export function renameLibrary(id, newName) {
  return serialize(async () => {
    const trimmed = String(newName || '').trim();
    if (!trimmed || isDemoLibraryId(id)) return false;
    unwrap(await supabase.from('cabins').update({ name: trimmed.slice(0, 200) }).eq('id', id));
    state.cabins = state.cabins.map((cabin) => (cabin.id === id ? { ...cabin, name: trimmed } : cabin));
    return true;
  });
}

export function deleteLibrary(id) {
  return serialize(async () => {
    if (allLibraries().length <= 1) {
      throw new Error('Poslední knihovnu nelze smazat. Nejdřív vytvoř novou.');
    }
    if (isDemoLibraryId(id)) {
      state.demoLibrary = null;
      state.demoBooks = [];
      await saveSettings({ demo_hidden: true });
    } else {
      unwrap(await supabase.from('cabins').delete().eq('id', id));
      state.cabins = state.cabins.filter((cabin) => cabin.id !== id);
      state.books = state.books.filter((book) => book.library_id !== id);
    }
    if (state.settings.active_cabin === id) setActiveLibraryId(allLibraries()[0]?.id ?? null);
    return true;
  });
}

// ---------- knihy ----------

export function listBooks(libraryId = null, query = '') {
  let books = allBooks();
  if (libraryId) books = books.filter((book) => book.library_id === libraryId);

  books = [...books].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  const needle = query.trim().toLocaleLowerCase('cs');
  if (!needle) return books;

  return books.filter((book) =>
    [book.title, book.authors, book.isbn, book.publisher, genreOf(book)]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase('cs').includes(needle))
  );
}

export function addBook(book, targetLibraryId = null) {
  return serialize(async () => {
    let libId = targetLibraryId || getActiveLibraryId();
    if (!libId || isDemoLibraryId(libId)) libId = state.cabins[0]?.id;
    if (!libId) return { success: false };

    const isbn = cleanIsbnDigits(book.isbn);
    const duplicate = isbn && state.books.some((b) => b.library_id === libId && cleanIsbnDigits(b.isbn) === isbn);
    if (duplicate) return { success: false, duplicate: true };

    const prepared = {
      ...book,
      isbn,
      title: String(book.title || '').trim(),
      authors: String(book.authors || 'Neznámý autor').trim(),
      page_count: book.page_count ? Number.parseInt(book.page_count, 10) : null
    };
    const [row] = unwrap(await supabase.from('cabin_books').insert(bookToRow(prepared, libId)).select());
    const saved = rowToBook(row);
    state.books = [saved, ...state.books];
    return { success: true, book: saved };
  });
}

export function deleteBook(id) {
  return serialize(async () => {
    const demo = state.demoBooks.find((book) => book.id === id);
    if (demo) {
      state.demoBooks = state.demoBooks.filter((book) => book.id !== id);
      return true;
    }
    if (!state.books.some((book) => book.id === id)) return false;
    unwrap(await supabase.from('cabin_books').delete().eq('id', id));
    state.books = state.books.filter((book) => book.id !== id);
    return true;
  });
}

function patchRow(book) {
  const { title, authors, isbn, data } = bookToRow(book, book.library_id);
  return { title, authors, isbn, data };
}

async function persistBook(updated) {
  if (isDemoBook(updated)) {
    state.demoBooks = state.demoBooks.map((book) => (book.id === updated.id ? updated : book));
    return;
  }
  unwrap(await supabase.from('cabin_books').update(patchRow(updated)).eq('id', updated.id));
  state.books = state.books.map((book) => (book.id === updated.id ? updated : book));
}

export function updateBook(id, changes) {
  return serialize(async () => {
    const current = allBooks().find((book) => book.id === id);
    if (!current) return null;
    const updated = { ...current, ...changes };
    await persistBook(updated);
    return updated;
  });
}

// Přesune knihu na jinou poličku (žánr). Ruční volba se už nepřetřiďuje podle pravidel.
export function moveBookToShelf(id, genre) {
  const name = String(genre || '').trim();
  if (!name) return Promise.resolve(null);
  return updateBook(id, { genre: name, genre_locked: true });
}

// Přejmenuje poličku v jedné knihovně; stejný název jako jiná polička je sloučí.
export function renameShelf(libraryId, oldGenre, newGenre) {
  return serialize(async () => {
    const name = String(newGenre || '').trim();
    if (!name) return 0;
    const affected = allBooks().filter((book) => book.library_id === libraryId && genreOf(book) === oldGenre);
    await Promise.all(affected.map((book) => persistBook({ ...book, genre: name, genre_locked: true })));
    return affected.length;
  });
}

// Marks a book as lent to someone. `lentAt` is a YYYY-MM-DD date string.
export function lendBook(id, borrower, lentAt) {
  const name = String(borrower || '').trim();
  if (!name) return Promise.resolve(null);
  return updateBook(id, {
    loan: { borrower: name, lent_at: lentAt || new Date().toISOString().slice(0, 10) }
  });
}

export function returnBook(id) {
  return updateBook(id, { loan: null });
}

// Srovná knihy z knihovny v chatách se stavem výpůjček na serveru.
export function syncBorrowedBooks(loans) {
  return serialize(async () => {
    const before = state.books;
    const result = reconcileBorrowedBooks(before, state.cabins, loans);
    if (!result.changed) return { ...result, books: before };

    const beforeById = new Map(before.map((book) => [book.id, book]));
    const keptIds = new Set(result.books.map((book) => book.id));

    const removedIds = before.filter((book) => !keptIds.has(book.id)).map((book) => book.id);
    if (removedIds.length) unwrap(await supabase.from('cabin_books').delete().in('id', removedIds));

    const updated = result.books.filter(
      (book) => beforeById.has(book.id) && JSON.stringify(beforeById.get(book.id)) !== JSON.stringify(book)
    );
    await Promise.all(
      updated.map(async (book) =>
        unwrap(await supabase.from('cabin_books').update(patchRow(book)).eq('id', book.id))
      )
    );

    const fresh = result.books.filter((book) => !beforeById.has(book.id));
    let inserted = [];
    if (fresh.length) {
      inserted = unwrap(
        await supabase
          .from('cabin_books')
          .insert(fresh.map((book) => ({ ...bookToRow(book, book.library_id), created_at: book.created_at })))
          .select()
      ).map(rowToBook);
    }

    const updatedById = new Map(updated.map((book) => [book.id, book]));
    state.books = [
      ...inserted,
      ...before.filter((book) => keptIds.has(book.id)).map((book) => updatedById.get(book.id) ?? book)
    ];
    return { ...result, added: inserted, books: state.books };
  });
}

// ---------- záloha ----------

export function exportLibraryData() {
  return {
    libraries: state.cabins.map(({ id, name, created_at }) => ({ id, name, created_at })),
    books: state.books
  };
}

// Merges a backup into the current data. Existing libraries and books are kept;
// a book is skipped if its ISBN is already in the same library or it is a duplicate within the file.
export function importLibraryData({ libraries, books }) {
  return serialize(async () => {
    const byName = new Map(state.cabins.map((cabin) => [cabin.name, cabin]));
    const cabinFor = new Map();
    let librariesAdded = 0;

    for (const lib of libraries) {
      if (lib.demo || lib.id === DEMO_LIBRARY_ID) continue;
      let cabin = byName.get(lib.name);
      if (!cabin) {
        [cabin] = unwrap(
          await supabase
            .from('cabins')
            .insert({ user_id: state.userId, name: String(lib.name).trim().slice(0, 200) })
            .select()
        );
        state.cabins.push(cabin);
        byName.set(cabin.name, cabin);
        librariesAdded += 1;
      }
      cabinFor.set(lib.id, cabin);
    }

    const knownIsbns = new Set(
      state.books.filter((b) => b.isbn).map((b) => `${b.library_id}|${cleanIsbnDigits(b.isbn)}`)
    );
    const rows = [];
    for (const book of books) {
      if (book.demo) continue;
      const cabin = cabinFor.get(book.library_id) ?? state.cabins[0];
      const isbnKey = book.isbn ? `${cabin.id}|${cleanIsbnDigits(book.isbn)}` : null;
      if (isbnKey && knownIsbns.has(isbnKey)) continue;
      if (isbnKey) knownIsbns.add(isbnKey);
      rows.push({
        ...bookToRow(book, cabin.id),
        created_at: book.created_at || new Date().toISOString()
      });
    }

    const added = [];
    for (let i = 0; i < rows.length; i += 200) {
      const saved = unwrap(await supabase.from('cabin_books').insert(rows.slice(i, i + 200)).select());
      added.push(...saved.map(rowToBook));
    }
    state.books = [...added, ...state.books];
    return { librariesAdded, booksAdded: added.length, booksSkipped: books.length - added.length };
  });
}
