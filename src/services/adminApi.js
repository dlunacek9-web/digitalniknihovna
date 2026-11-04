import { supabase } from '../lib/supabase';
import { unwrap } from '../lib/errors';

const rpc = async (name, args) => unwrap(await supabase.rpc(name, args));

export const isAppAdmin = () => rpc('is_app_admin');
export const listAllUsers = () => rpc('admin_list_users');
export const listAllLibraries = () => rpc('admin_list_libraries');
export const deleteLibrary = (id) => rpc('admin_delete_library', { p_library_id: id });
export const deleteUser = (id) => rpc('admin_delete_user', { p_user_id: id });
