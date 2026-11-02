import React, { useEffect, useState } from 'react';
import { HandHelping, Trash2, Undo2, X } from 'lucide-react';
import { bookColor, genreOf, isLightColor } from '../services/genres';
import { OVERDUE_DAYS, daysSince, formatDays, formatLoanDate, todayIsoDate } from '../services/bookLoans';

const STATUSES = [
  ['want', 'Chci číst'],
  ['reading', 'Čtu'],
  ['read', 'Přečteno']
];

/** Detail knihy: obálka se natočí z hřbetu, pod ní stav čtení. */
export default function BookDetail({ book, shelfCount, onClose, onStatusChange, onDelete, onLend, onReturn }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [showLendForm, setShowLendForm] = useState(false);
  const [borrower, setBorrower] = useState('');
  const [lentAt, setLentAt] = useState(todayIsoDate());

  useEffect(() => {
    setConfirmDelete(false);
    setCoverFailed(false);
    setShowLendForm(false);
    setBorrower('');
  }, [book?.id]);

  if (!book) return null;

  const handleLend = (e) => {
    e.preventDefault();
    if (!borrower.trim()) return;
    onLend(book.id, borrower.trim(), lentAt);
    setShowLendForm(false);
    setBorrower('');
  };

  const loanDays = book.loan ? daysSince(book.loan.lent_at) : 0;
  const isOverdue = loanDays > OVERDUE_DAYS;
  const color = bookColor(book);
  const showImage = book.cover_url && !coverFailed;
  const facts = [
    book.page_count && [book.page_count, 'stran'],
    book.publication_date && [book.publication_date, 'vydáno'],
    [shelfCount, 'na poličce']
  ].filter(Boolean);

  return (
    <div className="book-detail" role="dialog" aria-modal="true" aria-label={book.title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="book-detail__sheet">
        <button type="button" className="round-btn book-detail__close" onClick={onClose} aria-label="Zavřít">
          <X size={18} />
        </button>
        <div className="big-book">
          <div className="big-book__cover" style={{ background: color, color: isLightColor(color) ? '#2A2420' : '#fff' }}>
            {showImage ? (
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
          <small className="eyebrow">{genreOf(book)}</small>
          <h2>{book.title}</h2>
          <p className="book-detail__by">{book.authors}</p>

          <div className="book-detail__facts">
            {facts.map(([value, label]) => (
              <div key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="status-pills">
            {STATUSES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={book.status === key ? 'is-on' : ''}
                onClick={() => onStatusChange(book, book.status === key ? null : key)}
              >
                {label}
              </button>
            ))}
          </div>

          {book.loan ? (
            <div className={`loan-card ${isOverdue ? 'is-overdue' : ''}`}>
              <HandHelping size={18} />
              <div>
                <b>Půjčeno: {book.loan.borrower}</b>
                <span>
                  od {formatLoanDate(book.loan.lent_at)} · {formatDays(loanDays)}
                  {isOverdue && ' · už je to dlouho!'}
                </span>
              </div>
              <button type="button" onClick={() => onReturn(book.id)}>
                <Undo2 size={14} /> Vrátila se
              </button>
            </div>
          ) : showLendForm ? (
            <form className="loan-form" onSubmit={handleLend}>
              <input
                value={borrower}
                onChange={(e) => setBorrower(e.target.value)}
                placeholder="Komu? Např. Pepa"
                aria-label="Komu půjčuješ"
                autoFocus
              />
              <input type="date" value={lentAt} max={todayIsoDate()} onChange={(e) => setLentAt(e.target.value)} aria-label="Datum půjčení" />
              <button type="submit" disabled={!borrower.trim()}>Půjčit</button>
              <button type="button" className="text-btn" onClick={() => setShowLendForm(false)}>Zrušit</button>
            </form>
          ) : (
            <button type="button" className="text-btn loan-open" onClick={() => setShowLendForm(true)}>
              <HandHelping size={14} /> Půjčit knihu
            </button>
          )}

          {(book.publisher || book.isbn) && (
            <p className="book-detail__small">
              {[book.publisher, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join(' · ')}
            </p>
          )}

          <button
            type="button"
            className={`text-btn ${confirmDelete ? 'is-danger' : ''}`}
            onClick={() => (confirmDelete ? onDelete(book.id) : setConfirmDelete(true))}
          >
            <Trash2 size={14} />
            {confirmDelete ? 'Opravdu odstranit z chaty?' : 'Odstranit knihu'}
          </button>
        </div>
      </div>
    </div>
  );
}
