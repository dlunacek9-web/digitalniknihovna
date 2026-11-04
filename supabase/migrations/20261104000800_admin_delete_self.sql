-- Správce aplikace smí smazat i vlastní účet (stránka /admin má tlačítko u každého účtu).
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_app_admin();
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Účet neexistuje.';
  end if;

  update public.catalog_items i set status = 'available'
  where i.status in ('reserved', 'on_loan')
    and exists (
      select 1 from public.loans l
      where l.catalog_item_id = i.id and l.reader_id = p_user_id and l.status in ('approved', 'picked_up')
    );
  delete from public.loans l where l.reader_id = p_user_id;
  delete from auth.users u where u.id = p_user_id;
end;
$$;
