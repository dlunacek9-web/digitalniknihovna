import React, { useEffect, useState } from 'react';
import { HandHelping, Landmark, Pencil, Trash2, Undo2, X } from 'lucide-react';
import { bookColor, genreOf, isLightColor } from '../services/genres';
import GenreField from './GenreField';
import BookFields, { bookToFields, validateBookFields } from './BookFields';
import ReturnLoanButton from './ReturnLoanButton';
import { OVERDUE_DAYS, daysSince, formatDays, formatLoanDate, todayIsoDate } from '../services/bookLoans';
import { canRequestReturn, formatDate, isOverdue as isLoanOverdue, loanStatusLabel } from '../lib/loanRules';

const STATUSES = [
  ['want', 'Chci číst'],
  ['reading', 'Čtu'],
  ['read', 'Přečteno']
];

/** Detail knihy: obálka se natočí z hřbetu, pod ní stav čtení. */
export default function BookDetail({ book, shelfCount, shelfNames = [], onMoveToShelf, onClose, onStatusChange, onEdit, onDelete, onLend, onReturn, onRequestReturn }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [showLendForm, setShowLendForm] = useState(false);
  const [borrower, setBorrower] = useState('');
  const [lentAt, setLentAt] = useState(todayIsoDate());
  const [moving, setMoving] = useState(false);
  const [shelfDraft, setShelfDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(null);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    setConfirmDelete(false);
    setCoverFailed(false);
    setShowLendForm(false);
    setBorrower('');
    setMoving(false);
    setEditing(false);
    setEditError('');
  }, [book?.id]);

  if (!book) return null;

  const handleLend = (e) => {
    e.preventDefault();
    if (!borrower.trim()) return;
    onLend(book.id, borrower.trim(), lentAt);
    setShowLendForm(false);
    setBorrower('');
  };

  const borrowed = book.library_loan;

  const startEdit = () => {
    setFields(bookToFields(book));
    setEditError('');
    setEditing(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const problem = validateBookFields(fields);
    if (problem) {
      setEditError(problem);
      return;
    }
    const ok = await onEdit(book, {
      title: fields.title.trim(),
      authors: fields.authors.trim() || 'Neznámý autor',
      isbn: fields.isbn.replace(/[-\s]/g, ''),
      publisher: fields.publisher.trim(),
      publication_date: fields.publication_date.trim(),
      page_count: fields.page_count ? Number.parseInt(fields.page_count, 10) : null,
      cover_url: fields.cover_url.trim()
    });
    if (ok) {
      setEditing(false);
      setCoverFailed(false);
    }
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
          {book.demo && (
            <p className="demo-note" role="note">
              Ukázková kniha: změny se neukládají a po obnovení stránky zmizí.
            </p>
          )}
          {editing ? (
            <form className="book-edit" onSubmit={saveEdit} noValidate>
              <small className="eyebrow">Upravit údaje knihy</small>
              <BookFields value={fields} onChange={setFields} />
              {editError && <p className="preview-warning" role="alert">{editError}</p>}
              <div className="preview-actions">
                <button type="submit" className="dock-btn btn-ember">Uložit</button>
                <button type="button" className="text-btn" onClick={() => setEditing(false)}>Zrušit</button>
              </div>
            </form>
          ) : (
          <>
          <small className="eyebrow">{genreOf(book)}</small>
          {moving ? (
            <form
              className="shelf-move"
              onSubmit={(e) => {
                e.preventDefault();
                onMoveToShelf(book, shelfDraft);
                setMoving(false);
              }}
            >
              <GenreField value={shelfDraft} onChange={setShelfDraft} existingGenres={shelfNames} />
              <div className="shelf-move__actions">
                <button type="submit" disabled={!shelfDraft.trim() || shelfDraft.trim() === genreOf(book)}>Přesunout</button>
                <button type="button" className="text-btn" onClick={() => setMoving(false)}>Zrušit</button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setShelfDraft(genreOf(book));
                setMoving(true);
              }}
            >
              <Pencil size={14} /> Změnit poličku
            </button>
          )}
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

          {borrowed ? (
            <div className={`loan-card ${isLoanOverdue(borrowed) ? 'is-overdue' : ''}`}>
              <Landmark size={18} />
              <div>
                <b>Z knihovny{borrowed.library_name ? `: ${borrowed.library_name}` : ''}</b>
                <span>
                  {loanStatusLabel(borrowed)}
                  {borrowed.due_at && ` · vrátit do ${formatDate(borrowed.due_at)}`}
                </span>
              </div>
              {canRequestReturn(borrowed) && (
                <ReturnLoanButton onConfirm={() => onRequestReturn(book)} />
              )}
            </div>
          ) : book.loan ? (
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

          {!borrowed && (
            <div className="book-detail__actions">
              {onEdit && !book.demo && (
                <button type="button" className="text-btn" onClick={startEdit}>
                  <Pencil size={14} /> Upravit údaje
                </button>
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
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
