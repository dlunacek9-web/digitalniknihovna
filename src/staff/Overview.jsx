import React from 'react';
import { Link } from 'react-router';
import { useStaffContext } from './StaffApp';
import { useAsync } from '../lib/useAsync';
import { ACTIVE_LOAN_STATUSES, isOverdue } from '../lib/loanRules';
import { countCatalog, listLibraryLoans } from '../services/publicLibraryApi';
import { LoadState } from '../pages/PlainParts';

export default function Overview() {
  const { library } = useStaffContext();
  const { data, loading, error, reload } = useAsync(async () => {
    const [items, loans] = await Promise.all([
      countCatalog(library.id),
      listLibraryLoans(library.id, ACTIVE_LOAN_STATUSES)
    ]);
    return { items, loans };
  }, [library.id]);

  const loans = data?.loans ?? [];
  const count = (status) => loans.filter((l) => l.status === status).length;
  const overdue = loans.filter((l) => isOverdue(l)).length;

  return (
    <>
      <header className="staff-head">
        <h1>Přehled</h1>
      </header>
      {!library.loans_enabled && (
        <p className="plain-notice" style={{ marginBottom: 16 }}>
          Půjčování je vypnuté, čtenáři zatím nemohou žádat o knihy. Zapíná ho správce v nastavení.
        </p>
      )}
      <LoadState loading={loading} error={error} hasData={Boolean(data)} onRetry={reload}>
        <div className="staff-cards">
          <Link className="staff-card" to="/knihovnik/katalog"><b>{data?.items}</b> výtisků v katalogu</Link>
          <Link className={`staff-card ${count('requested') ? 'is-warn' : ''}`} to="/knihovnik/zadosti">
            <b>{count('requested')}</b> čekajících žádostí
          </Link>
          <Link className="staff-card" to="/knihovnik/vypujcky"><b>{count('approved')}</b> čeká na předání</Link>
          <Link className="staff-card" to="/knihovnik/vypujcky"><b>{count('picked_up')}</b> půjčeno</Link>
          <Link className={`staff-card ${overdue ? 'is-warn' : ''}`} to="/knihovnik/vypujcky"><b>{overdue}</b> po termínu</Link>
        </div>
      </LoadState>
    </>
  );
}
