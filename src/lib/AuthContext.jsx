import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import { toCzechMessage, unwrap } from './errors';
import { loadLibraryStore, resetLibraryStore } from '../services/libraryStore';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [sessionKnown, setSessionKnown] = useState(!isSupabaseConfigured);
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [membershipsReady, setMembershipsReady] = useState(false);
  const [membershipsError, setMembershipsError] = useState('');
  const [storeReady, setStoreReady] = useState(false);
  const [storeError, setStoreError] = useState('');
  const [storeAttempt, setStoreAttempt] = useState(0);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setSessionKnown(true);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id;

  const refreshMemberships = useCallback(async () => {
    if (!userId) {
      setMemberships([]);
      setMembershipsError('');
      setMembershipsReady(true);
      return;
    }
    try {
      // Filtr je nutný: zaměstnanec přes RLS vidí i řádky svých kolegů.
      const rows = unwrap(
        await supabase.from('library_staff').select('library_id, role, libraries(*)').eq('user_id', userId)
      );
      setMemberships(rows);
      setMembershipsError('');
    } catch (err) {
      setMembershipsError(err.message);
    } finally {
      setMembershipsReady(true);
    }
  }, [userId]);

  // Chaty a knihy čtenáře se načtou z účtu hned po přihlášení.
  // Data se mažou jen po odhlášení, ať při prvním načtení nezmizí ukázka bez účtu.
  const previousUserId = useRef(null);
  useEffect(() => {
    setStoreReady(false);
    setStoreError('');
    const hadUser = previousUserId.current;
    previousUserId.current = userId ?? null;
    if (!userId) {
      if (hadUser) resetLibraryStore();
      return undefined;
    }
    let alive = true;
    loadLibraryStore(userId)
      .catch((err) => alive && setStoreError(err.message || 'Knihy se nepodařilo načíst.'))
      .finally(() => alive && setStoreReady(true));
    return () => {
      alive = false;
    };
  }, [userId, storeAttempt]);

  const reloadStore = useCallback(() => setStoreAttempt((n) => n + 1), []);

  useEffect(() => {
    setMembershipsReady(false);
    refreshMemberships();
  }, [refreshMemberships]);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      loading: !sessionKnown || (Boolean(userId) && !(membershipsReady && storeReady)),
      storeError,
      reloadStore,
      user,
      displayName: user?.user_metadata?.name || user?.email || '',
      memberships,
      membershipsError,
      refreshMemberships,
      passwordRecovery,
      finishPasswordRecovery: () => setPasswordRecovery(false),
      // Odkaz z emailu musí uživatel otevřít ve stejném prohlížeči (PKCE).
      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}`
        });
        if (error) throw new Error(toCzechMessage(error));
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(toCzechMessage(error));
      },
      // Přesměruje na Google; po návratu Supabase sám dokončí přihlášení (PKCE).
      async signInWithGoogle() {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}${window.location.pathname}` }
        });
        if (error) throw new Error(toCzechMessage(error));
      },
      // Vrací true, když je potřeba nejdřív potvrdit email.
      async signUp(name, email, password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`
          }
        });
        if (error) throw new Error(toCzechMessage(error));
        return !data.session;
      },
      // Jméno se ukládá do metadat účtu i do profilu, který vidí knihovníci.
      async updateName(name) {
        const clean = name.trim();
        if (!clean) throw new Error('Zadej jméno.');
        const { error } = await supabase.auth.updateUser({ data: { name: clean } });
        if (error) throw new Error(toCzechMessage(error));
        const { error: profileError } = await supabase.from('profiles').update({ name: clean }).eq('id', userId);
        if (profileError) throw new Error(toCzechMessage(profileError));
      },
      // Vrací true, když je potřeba nový email potvrdit odkazem.
      async updateEmail(email) {
        const { data, error } = await supabase.auth.updateUser(
          { email: email.trim() },
          { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
        );
        if (error) throw new Error(toCzechMessage(error));
        return data.user?.new_email != null;
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(toCzechMessage(error));
      },
      async deleteAccount() {
        const { error } = await supabase.rpc('delete_my_account');
        if (error) throw new Error(toCzechMessage(error));
        await supabase.auth.signOut({ scope: 'local' });
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(toCzechMessage(error));
      }
    }),
    [sessionKnown, userId, user, membershipsReady, storeReady, storeError, reloadStore, memberships, membershipsError, refreshMemberships, passwordRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
