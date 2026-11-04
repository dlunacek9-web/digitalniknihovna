import React, { useMemo, useState } from 'react';
import { useStaffContext } from './StaffApp';
import { useAction, useAsync } from '../lib/useAsync';
import { defaultDueDate, dueDateToIso, formatDate, isOverdue } from '../lib/loanRules';
import { listLibraryLoans, pickupLoan, rejectLoan, returnLoan } from '../services/publicLibraryApi';
import { ConfirmButton, LoadState } from '../pages/PlainParts';

const FILTERS = {
  all: { label: 'Všechny', test: () => true },
  approved: { label: 'Čeká na předání', test: (l) => l.status === 'approved' },
  picked_up: { label: 'Půjčené', test: (l) => l.status === 'picked_up' },
  overdue: { label: 'Po termínu', test: (l) => isOverdue(l) }
};

export default function Loans() {
  const { library } = useStaffContext();
  const { data, loading, error, reload } = useAsync(
    () => listLibraryLoans(library.id, ['approved', 'picked_up']),
    [library.id]
  );
  const [filter, setFilter] = useState('all');
  const [dueDates, setDueDates] = useState({});
  const action = useAction();

  const loans = useMemo(() => (data ?? []).filter(FILTERS[filter].test), [data, filter]);

  const act = (fn) => {
    action.run(async () => {
      try {
        await fn();
      } finally {
        await reload();
      }
    });
  };

  return (
    <>
      <header className="staff-head">
        <h1>Aktuální výpůjčky</h1>
        <button type="button" className="plain-btn" onClick={reload} disabled={loading}>Obnovit</button>
      </header>
      <div className="staff-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrovat výpůjčky">
          {Object.entries(FILTERS).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      {action.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{action.error}</p>}
      <LoadState loading={loading} error={error} hasData={Boolean(data)} onRetry={reload}>
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Kniha</th>
                <th>Čtenář</th>
                <th>Stav</th>
                <th>Termín vrácení</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const overdue = isOverdue(loan);
                const due = dueDates[loan.id] ?? defaultDueDate();
                return (
                  <tr key={loan.id} className={overdue ? 'is-overdue' : ''}>
                    <td>
                      {loan.catalog_items?.title}
                      <small>{[loan.catalog_items?.authors, loan.catalog_items?.inventory_number].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td>{loan.profiles?.name}</td>
                    <td>
                      {loan.status === 'approved' && <span className="staff-tag is-warn">Čeká na předání</span>}
                      {loan.status === 'picked_up' && !overdue && <span className="staff-tag is-ok">Půjčeno</span>}
                      {overdue && <span className="staff-tag is-warn">Po termínu</span>}
                    </td>
                    <td>{formatDate(loan.due_at)}</td>
                    <td>
                      {loan.status === 'approved' ? (
                        <div className="staff-row-actions">
                          <input
                            type="date"
                            value={due}
                            onChange={(e) => setDueDates({ ...dueDates, [loan.id]: e.target.value })}
                            aria-label="Termín vrácení"
                          />
                          <button
                            type="button"
                            className="plain-btn plain-btn--primary"
                            disabled={action.busy || !due}
                            onClick={() => act(() => pickupLoan(loan.id, dueDateToIso(due)))}
                          >
                            Předat
                          </button>
                          <ConfirmButton disabled={action.busy} onConfirm={() => act(() => rejectLoan(loan.id, 'Nevyzvednuto'))}>
                            Nevyzvednuto
                          </ConfirmButton>
                        </div>
                      ) : (
                        <ConfirmButton disabled={action.busy} confirmLabel="Potvrdit vrácení" onConfirm={() => act(() => returnLoan(loan.id))}>
                          Vrátit
                        </ConfirmButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && loans.length === 0 && <p className="staff-empty">Nic k zobrazení.</p>}
        </div>
      </LoadState>
    </>
  );
}
