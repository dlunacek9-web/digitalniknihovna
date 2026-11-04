import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import { toCzechMessage, unwrap } from './errors';

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

  useEffect(() => {
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionKnown(true);
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

  useEffect(() => {
    setMembershipsReady(false);
    refreshMemberships();
  }, [refreshMemberships]);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      loading: !sessionKnown || (Boolean(userId) && !membershipsReady),
      user,
      displayName: user?.user_metadata?.name || user?.email || '',
      memberships,
      membershipsError,
      refreshMemberships,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(toCzechMessage(error));
      }
    }),
    [sessionKnown, userId, user, membershipsReady, memberships, membershipsError, refreshMemberships]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
