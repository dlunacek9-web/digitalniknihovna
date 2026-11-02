import React, { useMemo } from 'react';
import { HandHelping, Undo2 } from 'lucide-react';
import { OVERDUE_DAYS, formatDays, formatLoanDate, groupLoansByBorrower } from '../services/bookLoans';

export default function LoansList({ books, onReturnBook, onOpenBook }) {
  const groups = useMemo(() => groupLoansByBorrower(books), [books]);
  const lentCount = groups.reduce((sum, group) => sum + group.books.length, 0);

  return (
    <div>
      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5 px-1">
        Kdo mi co dluží {lentCount > 0 && <span className="text-amber-700">· {lentCount}</span>}
      </h3>

      {groups.length === 0 ? (
        <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <HandHelping className="w-4 h-4" />
          </div>
          <p className="text-[11px] text-stone-500">
            Všechny knihy jsou doma. Půjčenou knihu označíš v jejím detailu tlačítkem „Půjčit knihu“.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((group) => {
            const groupOverdue = group.longestDays > OVERDUE_DAYS;
            return (
              <div key={group.borrower} className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm">
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      groupOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {group.borrower.charAt(0).toLocaleUpperCase('cs')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-stone-900 truncate">{group.borrower}</p>
                    <p className="text-[11px] text-stone-500">
                      {group.books.length === 1 ? '1 kniha' : group.books.length < 5 ? `${group.books.length} knihy` : `${group.books.length} knih`}
                      {groupOverdue && <span className="text-red-600 font-semibold"> · připomeň se!</span>}
                    </p>
                  </div>
                </div>

                <ul className="space-y-2">
                  {group.books.map((book) => {
                    const overdue = book.loanDays > OVERDUE_DAYS;
                    return (
                      <li key={book.id} className="flex items-center space-x-2 bg-stone-50 rounded-2xl p-2.5 border border-stone-100">
                        <button type="button" onClick={() => onOpenBook(book)} className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-bold text-stone-800 truncate">{book.title}</p>
                          <p className={`text-[11px] ${overdue ? 'text-red-600 font-semibold' : 'text-stone-500'}`}>
                            od {formatLoanDate(book.loan.lent_at)} · {formatDays(book.loanDays)}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onReturnBook(book.id)}
                          title="Kniha se vrátila"
                          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 text-[11px] font-semibold hover:bg-burgundy-50 hover:border-burgundy-900/20 flex-shrink-0"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Vráceno</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
