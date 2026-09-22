import React, { useState } from 'react';
import { X, Trash2, Calendar, Building, FileText, Hash, AlertTriangle } from 'lucide-react';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';

export default function BookDetailModal({ book, onClose, onDelete }) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!book) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(book.id);
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-stone-200">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-stone-50/50">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Detail knihy</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Cover & Main Info */}
          <div className="flex space-x-4">
            <div className="w-24 h-36 flex-shrink-0 bg-stone-100 rounded-xl overflow-hidden shadow-md border border-stone-200/80 relative">
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
              <h2 className="text-lg font-bold text-stone-900 leading-snug">{book.title}</h2>
              <p className="text-burgundy-900 font-semibold text-sm mt-1">{book.authors || 'Neznámý autor'}</p>

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
                    <span>ISBN: <strong className="text-stone-800 tracking-wider font-mono">{book.isbn}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {book.description ? (
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Popis knihy</h4>
              <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto pr-1">
                {book.description}
              </p>
            </div>
          ) : null}

          {/* Delete Section */}
          <div className="pt-2 border-t border-stone-100">
            {!showConfirmDelete ? (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="w-full py-2.5 px-4 rounded-2xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Odstranit z knihovny</span>
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-center space-y-3">
                <div className="flex items-center justify-center space-x-2 text-red-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Opravdu chceš knihu odstranit?</span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    className="flex-1 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-xs font-medium hover:bg-stone-50"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {isDeleting ? 'Odstraňuji...' : 'Ano, odstranit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
