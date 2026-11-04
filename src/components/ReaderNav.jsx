import React from 'react';
import { Link, NavLink } from 'react-router';
import { ClipboardList, LogIn, UserCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

/** Přepínač Moje chata / Knihovny a odkazy na účet. Bez Supabase se nezobrazí. */
export default function ReaderNav() {
  const { configured, user, memberships } = useAuth();
  if (!configured) return null;

  return (
    <nav className="reader-nav" aria-label="Čtenářská část">
      <div className="reader-switch">
        <NavLink to="/" end>Moje chata</NavLink>
        <NavLink to="/knihovny">Knihovny</NavLink>
      </div>
      {memberships.length > 0 && (
        <Link className="chip-glass" to="/knihovnik" aria-label="Knihovnická část">
          <ClipboardList size={16} />
          <span>Knihovník</span>
        </Link>
      )}
      {user ? (
        <Link className="chip-glass" to="/ucet" aria-label="Účet">
          <UserCircle size={16} />
          <span>Účet</span>
        </Link>
      ) : (
        <Link className="chip-glass" to="/prihlaseni" aria-label="Přihlásit se">
          <LogIn size={16} />
          <span>Přihlásit se</span>
        </Link>
      )}
    </nav>
  );
}
