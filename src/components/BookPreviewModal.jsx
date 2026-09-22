import React, { useState } from 'react';
import { PlusCircle, X, Calendar, Building, FileText, Hash, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';

export default function BookPreviewModal({ book, alreadyInLibrary, onConfirm, onCancel }) {
  const [isSaving, setIsSaving] = useState(false);

  if (!book) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await onConfirm(book);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-stone-200">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Kniha nalezena</span>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">

          {/* Duplicate Warning Banner */}
          {alreadyInLibrary && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center space-x-2.5 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-semibold">Tuto knihu už v knihovně máš.</span>
            </div>
          )}

          {/* Book Card Details */}
          <div className="flex space-x-4">
            <div className="w-24 h-36 flex-shrink-0 bg-stone-100 rounded-xl overflow-hidden shadow-md border border-stone-200 relative">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`w-full h-full flex items-center justify-center bg-stone-100 p-2 text-center text-stone-500 text-xs ${
                  book.cover_url ? 'hidden' : 'flex'
                }`}
              >
                <BookCoverPlaceholder title={book.title} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-stone-900 leading-snug">{book.title}</h2>
              <p className="text-burgundy-900 font-semibold text-xs mt-1">{book.authors || 'Neznámý autor'}</p>

              <div className="mt-3 space-y-1.5 text-xs text-stone-600">
                {book.publication_date && (
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span>Rok: <strong className="text-stone-800">{book.publication_date}</strong></span>
                  </div>
                )}
                {book.page_count && (
                  <div className="flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span>Počet stran: <strong className="text-stone-800">{book.page_count}</strong></span>
                  </div>
                )}
                {book.publisher && (
                  <div className="flex items-center space-x-1.5">
                    <Building className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span className="truncate">Vydavatel: <strong className="text-stone-800">{book.publisher}</strong></span>
                  </div>
                )}
                {book.isbn && (
                  <div className="flex items-center space-x-1.5">
                    <Hash className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span>ISBN: <strong className="text-stone-800 font-mono tracking-wider">{book.isbn}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description snippet if present */}
          {book.description ? (
            <div className="bg-stone-50 rounded-2xl p-3 border border-stone-100">
              <p className="text-[11px] text-stone-600 line-clamp-3 leading-relaxed">
                {book.description}
              </p>
            </div>
          ) : null}

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <button
              onClick={handleSave}
              disabled={isSaving || alreadyInLibrary}
              className={`w-full py-3.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition-all ${
                alreadyInLibrary
                  ? 'bg-stone-200 text-stone-400 shadow-none cursor-not-allowed'
                  : 'bg-burgundy-900 hover:bg-burgundy-800 text-white shadow-burgundy-900/20 active:scale-98'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSaving ? 'Ukládám do knihovny...' : alreadyInLibrary ? 'Kniha je již v knihovně' : 'Přidat do knihovny'}</span>
            </button>

            <button
              onClick={onCancel}
              className="w-full py-2.5 px-4 rounded-2xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
