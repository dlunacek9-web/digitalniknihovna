-- Čtenář si může nadobro smazat vlastní účet.
-- Výtisky z aktivních výpůjček se uvolní, historie výpůjček účtu se smaže.
-- Účet jediného správce knihovny smazat nejde, knihovna by zůstala bez správce.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_name text;
begin
  select l.name into v_name
  from public.library_staff s
  join public.libraries l on l.id = s.library_id
  where s.user_id = v_uid and s.role = 'admin'
    and not exists (
      select 1 from public.library_staff o
      where o.library_id = s.library_id and o.role = 'admin' and o.user_id <> v_uid
    )
  limit 1;
  if v_name is not null then
    raise exception 'Jsi jediný správce knihovny %. Nejdřív jmenuj jiného správce.', v_name;
  end if;

  update public.catalog_items i set status = 'available'
  where i.status in ('reserved', 'on_loan')
    and exists (
      select 1 from public.loans l
      where l.catalog_item_id = i.id and l.reader_id = v_uid and l.status in ('approved', 'picked_up')
    );
  delete from public.loans l where l.reader_id = v_uid;
  delete from auth.users u where u.id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
