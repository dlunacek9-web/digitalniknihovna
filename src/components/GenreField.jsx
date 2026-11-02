import React from 'react';

/** Výběr poličky: existující žánry jako štítky + volné pole pro nový žánr. */
export default function GenreField({ value, onChange, existingGenres = [] }) {
  const options = [...new Set([value, ...existingGenres].filter(Boolean))];

  return (
    <div className="genre-field">
      <label className="eyebrow" htmlFor="genre-input">Polička</label>
      <input
        id="genre-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Např. Sci-fi"
        autoComplete="off"
      />
      {options.length > 1 && (
        <div className="genre-field__chips">
          {options.map((genre) => (
            <button
              key={genre}
              type="button"
              className={genre === value ? 'is-on' : ''}
              onClick={() => onChange(genre)}
            >
              {genre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
