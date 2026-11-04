import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ cabins: [], deletes: [] }));

// Stačí náhrada dotazů, které používá načtení a mazání chat.
vi.mock('../lib/supabase', () => {
  const builder = (table) => {
    let isDelete = false;
    const result = () => {
      if (isDelete) return { data: null, error: null };
      if (table === 'profiles') return { data: { settings: {} }, error: null };
      return { data: table === 'cabins' ? db.cabins : [], error: null };
    };
    const query = {
      select: () => query,
      order: () => query,
      range: () => query,
      single: () => query,
      update: () => query,
      delete: () => {
        isDelete = true;
        return query;
      },
      eq: (_column, value) => {
        if (isDelete) db.deletes.push({ table, value });
        return query;
      },
      then: (resolve) => resolve(result())
    };
    return query;
  };
  return { supabase: { from: builder }, isSupabaseConfigured: true };
});

const { deleteLibrary, getLibraries, loadLibraryStore } = await import('./libraryStore.js');
const { DEMO_LIBRARY_ID } = await import('./demoLibrary.js');

const cabin = (id) => ({ id, user_id: 'u1', name: id, created_at: '2026-01-01T00:00:00Z' });

describe('deleteLibrary', () => {
  beforeEach(() => {
    db.cabins = [];
    db.deletes = [];
  });

  it('nesmaže poslední vlastní chatu, i když zbývá ukázková', async () => {
    db.cabins = [cabin('a')];
    await loadLibraryStore('u1');
    expect(getLibraries().map((lib) => lib.id)).toEqual([DEMO_LIBRARY_ID, 'a']);

    await expect(deleteLibrary('a')).rejects.toThrow('Poslední knihovnu nelze smazat');
    expect(db.deletes).toEqual([]);
    expect(getLibraries().some((lib) => lib.id === 'a')).toBe(true);
  });

  it('smaže vlastní chatu, když zbývá jiná vlastní', async () => {
    db.cabins = [cabin('a'), cabin('b')];
    await loadLibraryStore('u1');

    await deleteLibrary('a');
    expect(db.deletes).toEqual([{ table: 'cabins', value: 'a' }]);
    expect(getLibraries().map((lib) => lib.id)).toEqual([DEMO_LIBRARY_ID, 'b']);
  });

  it('skryje ukázkovou chatu a vlastní nechá', async () => {
    db.cabins = [cabin('a')];
    await loadLibraryStore('u1');

    await deleteLibrary(DEMO_LIBRARY_ID);
    expect(getLibraries().map((lib) => lib.id)).toEqual(['a']);
  });
});
