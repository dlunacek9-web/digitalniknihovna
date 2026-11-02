import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { bookColor, genreOf, isLightColor } from '../services/genres';
import GenreField from './GenreField';

export default function BookPreviewModal({ book, alreadyInLibrary, existingGenres = [], onConfirm, onCancel }) {
  const [isSaving, setIsSaving] = useState(false);
  const [genre, setGenre] = useState(() => genreOf(book));
  const [coverFailed, setCoverFailed] = useState(false);

  if (!book) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await onConfirm({ ...book, genre: genre.trim() || genreOf(book) });
    setIsSaving(false);
  };

  const color = bookColor(book);
  const isNewShelf = genre.trim() && !existingGenres.includes(genre.trim());
  const facts = [
    book.publication_date && ['Rok', book.publication_date],
    book.page_count && ['Stran', book.page_count],
    book.publisher && ['Vydavatel', book.publisher]
  ].filter(Boolean);

  return (
    <div className="book-detail" role="dialog" aria-modal="true" aria-label="Nalezená kniha" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="book-detail__sheet">
        <button type="button" className="round-btn book-detail__close" onClick={onCancel} aria-label="Zavřít">
          <X size={18} />
        </button>

        <div className="big-book">
          <div className="big-book__cover" style={{ background: color, color: isLightColor(color) ? '#2A2420' : '#fff' }}>
            {book.cover_url && !coverFailed ? (
              <img src={book.cover_url} alt="" onError={() => setCoverFailed(true)} />
            ) : (
              <>
                <i>{book.authors}</i>
                <span className="ornament" />
                <b>{book.title}</b>
              </>
            )}
          </div>
        </div>

        <div className="book-detail__info">
          <small className="eyebrow">Kniha nalezena</small>
          <h2>{book.title}</h2>
          <p className="book-detail__by">{book.authors || 'Neznámý autor'}</p>

          {facts.length > 0 && (
            <dl className="preview-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <GenreField value={genre} onChange={setGenre} existingGenres={existingGenres} />
          <p className="preview-hint">
            {isNewShelf ? 'Pro tenhle žánr v chatě přibije truhlář novou poličku.' : 'Kniha se postaví k ostatním na poličku.'}
          </p>

          {alreadyInLibrary && (
            <p className="preview-warning">
              <AlertTriangle size={16} /> Tuhle knihu už v chatě máš.
            </p>
          )}

          <div className="preview-actions">
            <button type="button" className="dock-btn btn-ember" onClick={handleSave} disabled={isSaving || alreadyInLibrary}>
              {isSaving ? 'Ukládám…' : alreadyInLibrary ? 'Už je na poličce' : 'Postavit na poličku'}
            </button>
            <button type="button" className="text-btn" onClick={onCancel}>
              Zrušit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
