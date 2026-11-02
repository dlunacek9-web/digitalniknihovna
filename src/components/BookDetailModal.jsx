import React, { useState } from 'react';
import { X, Trash2, Calendar, Building, FileText, Hash, AlertTriangle, HandHelping, Undo2 } from 'lucide-react';
import { BookCoverPlaceholder } from './BookCoverPlaceholder';
import { OVERDUE_DAYS, daysSince, formatDays, formatLoanDate, todayIsoDate } from '../services/bookLoans';

export default function BookDetailModal({ book, onClose, onDelete, onLend, onReturn }) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showLendForm, setShowLendForm] = useState(false);
  const [borrower, setBorrower] = useState('');
  const [lentAt, setLentAt] = useState(todayIsoDate());

  if (!book) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(book.id);
    setIsDeleting(false);
  };

  const handleLend = (e) => {
    e.preventDefault();
    if (!borrower.trim()) return;
    onLend(book.id, borrower.trim(), lentAt);
    setShowLendForm(false);
    setBorrower('');
  };

  const loanDays = book.loan ? daysSince(book.loan.lent_at) : 0;
  const isOverdue = loanDays > OVERDUE_DAYS;

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

          {/* Loan Section */}
          {book.loan ? (
            <div className={`rounded-2xl p-4 border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200/70'}`}>
              <div className="flex items-start space-x-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  <HandHelping className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-900">
                    Půjčeno: <span className={isOverdue ? 'text-red-700' : 'text-amber-800'}>{book.loan.borrower}</span>
                  </p>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    od {formatLoanDate(book.loan.lent_at)} · {formatDays(loanDays)}
                    {isOverdue && ' · už je to dlouho!'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onReturn(book.id)}
                className="mt-3 w-full py-2 bg-white border border-stone-200 rounded-xl text-stone-800 text-xs font-semibold hover:bg-stone-50 flex items-center justify-center space-x-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Kniha se vrátila</span>
              </button>
            </div>
          ) : showLendForm ? (
            <form onSubmit={handleLend} className="bg-stone-50 rounded-2xl p-4 border border-stone-100 space-y-3">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Půjčit knihu</h4>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  value={borrower}
                  onChange={(e) => setBorrower(e.target.value)}
                  placeholder="Komu? Např. Pepa"
                  autoFocus
                  className="min-w-0 px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
                />
                <input
                  type="date"
                  value={lentAt}
                  max={todayIsoDate()}
                  onChange={(e) => setLentAt(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-burgundy-900/20 focus:border-burgundy-900"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowLendForm(false)}
                  className="flex-1 py-2 bg-white border border-stone-200 rounded-xl text-stone-700 text-xs font-medium hover:bg-stone-50"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={!borrower.trim()}
                  className="flex-1 py-2 bg-burgundy-900 hover:bg-burgundy-800 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  Půjčit
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowLendForm(true)}
              className="w-full py-2.5 px-4 rounded-2xl border border-amber-200 bg-amber-50/60 hover:bg-amber-50 text-amber-800 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors"
            >
              <HandHelping className="w-4 h-4" />
              <span>Půjčit knihu</span>
            </button>
          )}

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
