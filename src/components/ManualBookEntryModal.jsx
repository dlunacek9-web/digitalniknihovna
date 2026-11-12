import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import GenreField from './GenreField';
import { FALLBACK_GENRE } from '../services/genres';
import BookFields, { EMPTY_BOOK_FIELDS, validateBookFields } from './BookFields';

/**
 * Ruční přidání knihy: po neúspěšném hledání ISBN, nebo pro knihu bez čárového kódu.
 * Vzhled odpovídá detailu knihy, aby skener a chata působily jako jedna aplikace.
 */
export default function ManualBookEntryModal({
  initialIsbn = '',
  existingGenres = [],
  libraries = [],
  targetLibraryId = '',
  onTargetChange,
  onConfirm,
  onCancel
}) {
  const [fields, setFields] = useState({ ...EMPTY_BOOK_FIELDS, isbn: initialIsbn || '' });
  const [genre, setGenre] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = validateBookFields(fields);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    await onConfirm({
      isbn: fields.isbn.trim(),
      title: fields.title.trim(),
      authors: fields.authors.trim() || 'Neznámý autor',
      publisher: fields.publisher.trim() || null,
      genre: genre.trim() || null,
      publication_date: fields.publication_date.trim() || null,
      page_count: fields.page_count ? Number.parseInt(fields.page_count, 10) : null,
      cover_url: fields.cover_url.trim() || null
    });
    setSaving(false);
  };

  return (
    <div className="book-detail" role="dialog" aria-modal="true" aria-label="Přidat knihu ručně" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="book-detail__sheet book-detail__sheet--form" onSubmit={handleSubmit} noValidate>
        <button type="button" className="round-btn book-detail__close" onClick={onCancel} aria-label="Zavřít">
          <X size={18} />
        </button>

        <div className="book-detail__info">
          <small className="eyebrow">Přidat knihu ručně</small>
          <h2>Vlastní kniha</h2>
          <p className="book-detail__by">
            {initialIsbn
              ? `Knihu s kódem ${initialIsbn} jsme v katalozích nenašli. Vyplň její údaje sám.`
              : 'Pro knihy bez čárového kódu. Stačí název, zbytek je nepovinný.'}
          </p>

          <BookFields value={fields} onChange={setFields} />

          {libraries.length > 1 && (
            <div className="genre-field book-form__block">
              <span className="eyebrow">Chata</span>
              <div className="genre-field__chips" role="group" aria-label="Do které chaty přidat">
                {libraries.map((lib) => (
                  <button
                    key={lib.id}
                    type="button"
                    className={lib.id === targetLibraryId ? 'is-on' : ''}
                    onClick={() => onTargetChange?.(lib.id)}
                  >
                    {lib.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="book-form__block">
            <GenreField value={genre} onChange={setGenre} existingGenres={existingGenres} />
            <p className="preview-hint">Když poličku nevyplníš, kniha půjde na poličku {FALLBACK_GENRE}.</p>
          </div>

          {error && <p className="preview-warning" role="alert">{error}</p>}

          <div className="preview-actions">
            <button type="submit" className="dock-btn btn-ember" disabled={saving}>
              {saving ? 'Ukládám…' : 'Postavit na poličku'}
            </button>
            <button type="button" className="text-btn" onClick={onCancel}>
              Zrušit
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
