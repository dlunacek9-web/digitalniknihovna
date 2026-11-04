import { supabase } from '../lib/supabase';
import { unwrap } from '../lib/errors';

// PostgREST vrací nejvýš 1000 řádků na dotaz, větší katalog se proto stahuje po stránkách.
const PAGE_SIZE = 1000;

async function fetchAll(buildQuery) {
  const rows = [];
  for (;;) {
    const page = unwrap(await buildQuery().range(rows.length, rows.length + PAGE_SIZE - 1));
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function rpc(name, args) {
  return unwrap(await supabase.rpc(name, args));
}

// ---------- knihovny ----------

export async function listLibraries() {
  return unwrap(await supabase.from('libraries').select('*').order('name'));
}

export function createLibrary({ name, address, city }) {
  return rpc('create_library', { p_name: name, p_address: address, p_city: city });
}

export async function updateLibrary(id, changes) {
  return unwrap(await supabase.from('libraries').update(changes).eq('id', id).select().single());
}

// ---------- katalog ----------

export function listCatalog(libraryId) {
  return fetchAll(() =>
    supabase.from('catalog_items').select('*').eq('library_id', libraryId).order('created_at').order('id')
  );
}

export async function countCatalog(libraryId) {
  const { count, error } = await supabase
    .from('catalog_items')
    .select('id', { count: 'exact', head: true })
    .eq('library_id', libraryId);
  unwrap({ data: null, error });
  return count ?? 0;
}

export async function addCatalogItem(libraryId, row) {
  return unwrap(await supabase.from('catalog_items').insert({ ...row, library_id: libraryId }).select().single());
}

export async function updateCatalogItem(id, row) {
  return unwrap(await supabase.from('catalog_items').update(row).eq('id', id).select().single());
}

export function setItemStatus(itemId, status) {
  return rpc('set_item_status', { p_item_id: itemId, p_status: status });
}

// ---------- výpůjčky ----------

export function listLibraryLoans(libraryId, statuses) {
  return fetchAll(() =>
    supabase
      .from('loans')
      .select('*, catalog_items(title, authors, inventory_number), profiles(name)')
      .eq('library_id', libraryId)
      .in('status', statuses)
      .order('requested_at')
      .order('id')
  );
}

export function listMyLoans(userId) {
  // Filtr je nutný: zaměstnanec přes RLS vidí i výpůjčky své knihovny.
  return fetchAll(() =>
    supabase
      .from('loans')
      .select('*, catalog_items(title, authors, libraries(name))')
      .eq('reader_id', userId)
      .order('requested_at', { ascending: false })
      .order('id')
  );
}

export const requestLoan = (itemId, note) => rpc('request_loan', { p_item_id: itemId, p_note: note || null });
export const cancelLoan = (loanId) => rpc('cancel_loan', { p_loan_id: loanId });
export const approveLoan = (loanId) => rpc('approve_loan', { p_loan_id: loanId });
export const rejectLoan = (loanId, note) => rpc('reject_loan', { p_loan_id: loanId, p_note: note || null });
export const pickupLoan = (loanId, dueAt) => rpc('pickup_loan', { p_loan_id: loanId, p_due_at: dueAt });
export const returnLoan = (loanId) => rpc('return_loan', { p_loan_id: loanId });

// ---------- zaměstnanci a pozvánky ----------

export async function listStaff(libraryId) {
  return unwrap(
    await supabase
      .from('library_staff')
      .select('user_id, role, created_at, profiles(name)')
      .eq('library_id', libraryId)
      .order('created_at')
  );
}

export const setStaffRole = (libraryId, userId, role) =>
  rpc('set_staff_role', { p_library_id: libraryId, p_user_id: userId, p_role: role });
export const removeStaff = (libraryId, userId) =>
  rpc('remove_staff', { p_library_id: libraryId, p_user_id: userId });

export async function listInvites(libraryId) {
  return unwrap(
    await supabase
      .from('library_invites')
      .select('*')
      .eq('library_id', libraryId)
      .order('created_at', { ascending: false })
  );
}

export const createInvite = (libraryId, role, validDays) =>
  rpc('create_invite', { p_library_id: libraryId, p_role: role, p_valid_days: validDays });
export const revokeInvite = (code) => rpc('revoke_invite', { p_code: code });
export const redeemInvite = (code) => rpc('redeem_invite', { p_code: code });
