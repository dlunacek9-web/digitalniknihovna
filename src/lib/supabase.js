import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Bez konfigurace funguje dál domácí chata, jen se nezobrazí účty a veřejné knihovny.
export const isSupabaseConfigured = Boolean(url && key);

// PKCE: návratová adresa z emailu nesmí používat hash, ten patří routeru.
export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { flowType: 'pkce' } })
  : null;
