import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useOutletContext } from 'react-router';
import { BookOpen, Inbox, LayoutDashboard, Repeat, Settings as SettingsIcon, Users } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useAction } from '../lib/useAsync';
import { NotConfigured, PageLoading } from '../pages/PlainParts';
import { getSetting, saveSettings } from '../services/libraryStore';
import Overview from './Overview';
import Catalog from './Catalog';
import Requests from './Requests';
import Loans from './Loans';
import StaffMembers from './StaffMembers';
import Settings from './Settings';
import '../styles/plain.css';

export function useStaffContext() {
  return useOutletContext();
}

function StaffLayout() {
  const { displayName, memberships, refreshMemberships, signOut } = useAuth();
  const [selectedId, setSelectedId] = useState(() => getSetting('staff_library'));
  const { error, run } = useAction();

  const membership = memberships.find((m) => m.library_id === selectedId) || memberships[0];
  const library = membership.libraries;
  const isAdmin = membership.role === 'admin';

  useEffect(() => {
    if (getSetting('staff_library') === membership.library_id) return;
    saveSettings({ staff_library: membership.library_id }).catch((err) => console.error('Saving staff library failed:', err));
  }, [membership.library_id]);

  const links = [
    { to: '/knihovnik', end: true, label: 'Přehled', icon: LayoutDashboard },
    { to: '/knihovnik/katalog', label: 'Katalog', icon: BookOpen },
    { to: '/knihovnik/zadosti', label: 'Žádosti', icon: Inbox },
    { to: '/knihovnik/vypujcky', label: 'Výpůjčky', icon: Repeat },
    ...(isAdmin
      ? [
          { to: '/knihovnik/zamestnanci', label: 'Zaměstnanci', icon: Users },
          { to: '/knihovnik/nastaveni', label: 'Nastavení', icon: SettingsIcon }
        ]
      : [])
  ];

  return (
    <div className="plain staff">
      <aside className="staff-side">
        <div className="staff-side__brand">
          <small>Knihovnická část</small>
          <b>{library?.name}</b>
          <small>{displayName} · {isAdmin ? 'správce' : 'zaměstnanec'}</small>
        </div>
        {memberships.length > 1 && (
          <select
            aria-label="Vybrat knihovnu"
            value={membership.library_id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.library_id} value={m.library_id}>{m.libraries?.name}</option>
            ))}
          </select>
        )}
        <nav className="staff-nav" aria-label="Knihovnická část">
          {links.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="staff-side__foot">
          {error && <p role="alert">{error}</p>}
          <Link to="/">Do čtenářské části</Link>
          <button type="button" onClick={() => run(signOut)}>Odhlásit se</button>
        </div>
      </aside>
      <main className="staff-main">
        {/* key: po přepnutí knihovny se nesmí zobrazit data té předchozí */}
        <Outlet key={membership.library_id} context={{ library, isAdmin, refreshMemberships }} />
      </main>
    </div>
  );
}

function AdminOnly({ children }) {
  const { isAdmin } = useStaffContext();
  if (!isAdmin) return <p className="plain-error" role="alert">Tuto část vidí jen správce knihovny.</p>;
  return children;
}

export default function StaffApp() {
  const { configured, loading, user, memberships, membershipsError } = useAuth();

  if (!configured) return <NotConfigured />;
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/prihlaseni?next=/knihovnik" replace />;
  if (membershipsError) {
    return (
      <main className="plain plain--center">
        <p className="plain-error" role="alert">{membershipsError}</p>
      </main>
    );
  }
  // Bez členství je cesta dál přes účet: založení knihovny nebo pozvánkový kód.
  if (memberships.length === 0) return <Navigate to="/ucet" replace />;

  return (
    <Routes>
      <Route element={<StaffLayout />}>
        <Route index element={<Overview />} />
        <Route path="katalog" element={<Catalog />} />
        <Route path="zadosti" element={<Requests />} />
        <Route path="vypujcky" element={<Loans />} />
        <Route path="zamestnanci" element={<AdminOnly><StaffMembers /></AdminOnly>} />
        <Route path="nastaveni" element={<AdminOnly><Settings /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/knihovnik" replace />} />
      </Route>
    </Routes>
  );
}
