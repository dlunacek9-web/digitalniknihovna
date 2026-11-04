import React, { useState } from 'react';
import { useStaffContext } from './StaffApp';
import { useAuth } from '../lib/AuthContext';
import { useAction, useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/loanRules';
import {
  createInvite,
  listInvites,
  listStaff,
  removeStaff,
  revokeInvite,
  setStaffRole
} from '../services/publicLibraryApi';
import { ConfirmButton, LoadState } from '../pages/PlainParts';

const ROLE_LABELS = { admin: 'Správce', staff: 'Zaměstnanec' };

function inviteState(invite, now = new Date()) {
  if (invite.used_at) return { label: `Použito ${formatDate(invite.used_at)}`, tag: 'is-off', open: false };
  if (new Date(invite.expires_at) <= now) return { label: 'Vypršelo', tag: 'is-off', open: false };
  return { label: `Platí do ${formatDate(invite.expires_at)}`, tag: 'is-ok', open: true };
}

function StaffTable({ libraryId }) {
  const { user, refreshMemberships } = useAuth();
  const { data, loading, error, reload } = useAsync(() => listStaff(libraryId), [libraryId]);
  const action = useAction();

  const act = (member, fn) => {
    action.run(async () => {
      await fn();
      // Vlastní změna role nebo odchod mění i to, co smí uživatel vidět.
      if (member.user_id === user.id) await refreshMemberships();
      else await reload();
    });
  };

  return (
    <section>
      <h2>Zaměstnanci</h2>
      {action.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{action.error}</p>}
      <LoadState loading={loading} error={error} hasData={Boolean(data)} onRetry={reload}>
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr><th>Jméno</th><th>Role</th><th>Od</th><th>Akce</th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((member) => (
                <tr key={member.user_id}>
                  <td>{member.profiles?.name}{member.user_id === user.id ? ' (ty)' : ''}</td>
                  <td>{ROLE_LABELS[member.role]}</td>
                  <td>{formatDate(member.created_at)}</td>
                  <td>
                    <div className="staff-row-actions">
                      <button
                        type="button"
                        className="plain-btn"
                        disabled={action.busy}
                        onClick={() =>
                          act(member, () => setStaffRole(libraryId, member.user_id, member.role === 'admin' ? 'staff' : 'admin'))
                        }
                      >
                        {member.role === 'admin' ? 'Změnit na zaměstnance' : 'Změnit na správce'}
                      </button>
                      <ConfirmButton disabled={action.busy} onConfirm={() => act(member, () => removeStaff(libraryId, member.user_id))}>
                        Odebrat
                      </ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LoadState>
    </section>
  );
}

function Invites({ libraryId }) {
  const { data, loading, error, reload } = useAsync(() => listInvites(libraryId), [libraryId]);
  const [role, setRole] = useState('staff');
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState('');
  const action = useAction();

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
    } catch {
      setCopied('');
    }
  };

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Pozvánkové kódy</h2>
      <p className="plain-muted" style={{ marginBottom: 12 }}>
        Kód předej novému kolegovi osobně. Po registraci ho zadá ve svém účtu. Každý kód platí jen jednou.
      </p>
      <form
        className="staff-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async () => {
            await createInvite(libraryId, role, Number(days));
            await reload();
          });
        }}
      >
        <label className="plain-field">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Zaměstnanec</option>
            <option value="admin">Správce</option>
          </select>
        </label>
        <label className="plain-field">
          Platnost (dní)
          <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} required />
        </label>
        <button type="submit" className="plain-btn plain-btn--primary" disabled={action.busy}>Vytvořit kód</button>
      </form>
      {action.error && <p className="plain-error" role="alert" style={{ marginBottom: 12 }}>{action.error}</p>}
      <LoadState loading={loading} error={error} hasData={Boolean(data)} onRetry={reload}>
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr><th>Kód</th><th>Role</th><th>Stav</th><th>Akce</th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((invite) => {
                const state = inviteState(invite);
                return (
                  <tr key={invite.code}>
                    <td className="staff-code">{invite.code}</td>
                    <td>{ROLE_LABELS[invite.role]}</td>
                    <td><span className={`staff-tag ${state.tag}`}>{state.label}</span></td>
                    <td>
                      {state.open && (
                        <div className="staff-row-actions">
                          <button type="button" className="plain-btn" onClick={() => copy(invite.code)}>
                            {copied === invite.code ? 'Zkopírováno' : 'Kopírovat'}
                          </button>
                          <ConfirmButton
                            disabled={action.busy}
                            onConfirm={() =>
                              action.run(async () => {
                                await revokeInvite(invite.code);
                                await reload();
                              })
                            }
                          >
                            Zrušit
                          </ConfirmButton>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data?.length === 0 && <p className="staff-empty">Zatím žádné kódy.</p>}
        </div>
      </LoadState>
    </section>
  );
}

export default function StaffMembers() {
  const { library } = useStaffContext();
  return (
    <>
      <header className="staff-head"><h1>Zaměstnanci a pozvánky</h1></header>
      <StaffTable libraryId={library.id} />
      <Invites libraryId={library.id} />
    </>
  );
}
