import React, { useState } from 'react';
import { useStaffContext } from './StaffApp';
import { useAction, useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/loanRules';
import { approveLoan, listLibraryLoans, rejectLoan } from '../services/publicLibraryApi';
import { LoadState } from '../pages/PlainParts';

export default function Requests() {
  const { library } = useStaffContext();
  const { data, loading, error, reload } = useAsync(() => listLibraryLoans(library.id, ['requested']), [library.id]);
  const [rejecting, setRejecting] = useState(null); // { id, note }
  const action = useAction();

  const act = (fn) => {
    action.run(async () => {
      try {
        await fn();
      } finally {
        // I po chybě (žádost mezitím vyřídil kolega) se načte aktuální stav.
        await reload();
      }
    });
  };

  return (
    <>
      <header className="staff-head">
        <h1>Žádosti o půjčení</h1>
        <button type="button" className="plain-btn" onClick={reload} disabled={loading}>Obnovit</button>
      </header>
      {action.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{action.error}</p>}
      <LoadState loading={loading} error={error} hasData={Boolean(data)} onRetry={reload}>
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Kniha</th>
                <th>Čtenář</th>
                <th>Požádáno</th>
                <th>Poznámka</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((loan) => (
                <tr key={loan.id}>
                  <td>
                    {loan.catalog_items?.title}
                    <small>{[loan.catalog_items?.authors, loan.catalog_items?.inventory_number].filter(Boolean).join(' · ')}</small>
                  </td>
                  <td>{loan.profiles?.name}</td>
                  <td>{formatDate(loan.requested_at)}</td>
                  <td>{loan.note}</td>
                  <td>
                    {rejecting?.id === loan.id ? (
                      <form
                        className="staff-row-actions"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const { note } = rejecting;
                          setRejecting(null);
                          act(() => rejectLoan(loan.id, note));
                        }}
                      >
                        <input
                          type="text"
                          value={rejecting.note}
                          onChange={(e) => setRejecting({ id: loan.id, note: e.target.value })}
                          placeholder="Důvod (nepovinné)"
                          aria-label="Důvod odmítnutí"
                          maxLength={500}
                          autoFocus
                        />
                        <button type="submit" className="plain-btn plain-btn--danger" disabled={action.busy}>Odmítnout</button>
                        <button type="button" className="plain-btn" onClick={() => setRejecting(null)}>Zpět</button>
                      </form>
                    ) : (
                      <div className="staff-row-actions">
                        <button
                          type="button"
                          className="plain-btn plain-btn--primary"
                          disabled={action.busy}
                          onClick={() => act(() => approveLoan(loan.id))}
                        >
                          Schválit
                        </button>
                        <button type="button" className="plain-btn" disabled={action.busy} onClick={() => setRejecting({ id: loan.id, note: '' })}>
                          Odmítnout
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.length === 0 && <p className="staff-empty">Žádné čekající žádosti.</p>}
        </div>
      </LoadState>
    </>
  );
}
