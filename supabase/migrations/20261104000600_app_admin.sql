-- Správa celé aplikace (stránka /admin): seznam účtů a knihoven, mazání spamu a testovacích dat.
-- Oprávnění určuje databáze: správce aplikace je ten, kdo je přihlášený účtem s potvrzeným
-- emailem daniel@lunacek.cz. Heslo se v repozitáři nikde neukládá, spravuje ho Supabase Auth.

create function private.is_app_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'daniel@lunacek.cz'
      and u.email_confirmed_at is not null
  );
end;
$$;

revoke all on function private.is_app_admin() from public;

create function private.require_app_admin()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_app_admin() then
    raise exception 'Jen správce aplikace.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

revoke all on function private.require_app_admin() from public;

create function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_app_admin();
$$;

create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  libraries text,
  loan_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_app_admin();
  return query
  select u.id, u.email::text, p.name, u.created_at, u.last_sign_in_at,
         u.email_confirmed_at is not null,
         coalesce((
           select string_agg(l.name || ' (' || s.role || ')', ', ' order by l.name)
           from public.library_staff s join public.libraries l on l.id = s.library_id
           where s.user_id = u.id
         ), ''),
         (select count(*) from public.loans o where o.reader_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

create function public.admin_list_libraries()
returns table (
  id uuid,
  name text,
  city text,
  address text,
  created_at timestamptz,
  created_by_name text,
  loans_enabled boolean,
  staff_count bigint,
  item_count bigint,
  loan_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_app_admin();
  return query
  select l.id, l.name, l.city, l.address, l.created_at, p.name, l.loans_enabled,
         (select count(*) from public.library_staff s where s.library_id = l.id),
         (select count(*) from public.catalog_items i where i.library_id = l.id),
         (select count(*) from public.loans o where o.library_id = l.id)
  from public.libraries l
  left join public.profiles p on p.id = l.created_by
  order by l.created_at desc;
end;
$$;

-- Smaže knihovnu včetně katalogu, výpůjček, zaměstnanců a pozvánek.
create function public.admin_delete_library(p_library_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_app_admin();
  if not exists (select 1 from public.libraries l where l.id = p_library_id) then
    raise exception 'Knihovna neexistuje.';
  end if;
  delete from public.loans l where l.library_id = p_library_id;
  delete from public.catalog_items i where i.library_id = p_library_id;
  delete from public.libraries l where l.id = p_library_id;
end;
$$;

-- Smaže účet. Jeho výpůjčky zmizí a výtisky se uvolní. Knihovny, kde byl jediným
-- správcem, zůstanou bez správce, takže je správce aplikace smaže zvlášť.
create function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_app_admin();
begin
  if p_user_id = v_admin then
    raise exception 'Vlastní účet správce aplikace tu smazat nejde.';
  end if;
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

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.is_app_admin()',
    'public.admin_list_users()',
    'public.admin_list_libraries()',
    'public.admin_delete_library(uuid)',
    'public.admin_delete_user(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to authenticated', v_signature);
  end loop;
end;
$$;
