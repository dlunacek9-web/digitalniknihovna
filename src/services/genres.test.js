import { describe, it, expect } from 'vitest';
import { classifyGenre, genreOf, groupIntoShelves, FALLBACK_GENRE } from './genres.js';

describe('genres', () => {
  it('classifyGenre maps Knihovny.cz subjects to friendly genres', () => {
    expect(classifyGenre([['norské romány'], ['detektivní romány']])).toBe('Krimi a thrillery');
    expect(classifyGenre([['anglické romány'], ['fantasy romány']])).toBe('Fantasy');
    expect(classifyGenre([['světové dějiny'], ['komiksy']])).toBe('Komiks');
    expect(classifyGenre([['americké romány']])).toBe('Romány');
    expect(classifyGenre([['recenze']])).toBeNull();
    expect(classifyGenre(null)).toBeNull();
  });

  it('genreOf normalizes saved genre, keeps custom ones, then subjects, then fallback', () => {
    expect(genreOf({ genre: 'Poezie', subjects: ['fantasy'] })).toBe('Poezie');
    expect(genreOf({ genre: 'Česká próza' })).toBe('Romány');
    expect(genreOf({ genre: 'Juvenile Fiction' })).toBe('Pro děti');
    expect(genreOf({ genre: 'Moje oblíbené' })).toBe('Moje oblíbené');
    expect(genreOf({ subjects: ['fantasy romány'] })).toBe('Fantasy');
    expect(genreOf({})).toBe(FALLBACK_GENRE);
  });

  it('groupIntoShelves creates one shelf per genre in creation order', () => {
    const shelves = groupIntoShelves([
      { id: 'b', genre: 'Sci-fi', created_at: '2026-01-02' },
      { id: 'a', genre: 'Poezie', created_at: '2026-01-01' },
      { id: 'c', genre: 'Sci-fi', created_at: '2026-01-03' }
    ]);
    expect(shelves.map((s) => s.genre)).toEqual(['Poezie', 'Sci-fi']);
    expect(shelves[1].books.map((b) => b.id)).toEqual(['b', 'c']);
  });
});
