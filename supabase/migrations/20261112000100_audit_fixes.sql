-- Opravy z generálky (docs/audit-generalka.md):
-- 1. Zprávy pro uživatele tykají jako zbytek aplikace.
-- 2. Čtenář smí mít nejvýš 5 aktivních žádostí a výpůjček, jinak by zabral celý katalog.
-- 3. Zaměstnanec může sám odejít z knihovny (leave_library).
-- 4. Správce aplikace nesmaže účet jediného správce knihovny, knihovna by zůstala bez správce.
-- create or replace zachová dosavadní granty funkcí.

create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Nejsi přihlášený.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create or replace function public.create_library(p_name text, p_address text default null, p_city text default null)
returns public.libraries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_library public.libraries;
begin
  if exists (select 1 from public.library_staff s where s.user_id = v_uid) then
    raise exception 'Už patříš do knihovny, další založit nemůžeš.';
  end if;

  insert into public.libraries (name, address, city, created_by)
  values (btrim(p_name), nullif(btrim(p_address), ''), nullif(btrim(p_city), ''), v_uid)
  returning * into v_library;

  insert into public.library_staff (library_id, user_id, role)
  values (v_library.id, v_uid, 'admin');

  return v_library;
end;
$$;

create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_invite public.library_invites;
begin
  select * into v_invite
  from public.library_invites i
  where i.code = upper(regexp_replace(p_code, '\s', '', 'g'))
    and i.used_at is null
    and i.expires_at > now()
  for update;

  if v_invite.code is null then
    raise exception 'Kód je neplatný nebo už vypršel.';
  end if;
  -- Člen kód nespotřebuje, a nemůže si tak ani zvýšit roli.
  if exists (
    select 1 from public.library_staff s
    where s.library_id = v_invite.library_id and s.user_id = v_uid
  ) then
    raise exception 'V této knihovně už jsi zaměstnanec.';
  end if;

  insert into public.library_staff (library_id, user_id, role)
  values (v_invite.library_id, v_uid, v_invite.role);

  update public.library_invites i
  set used_by = v_uid, used_at = now()
  where i.code = v_invite.code;

  return v_invite.library_id;
end;
$$;

create or replace function public.request_loan(p_item_id uuid, p_note text default null, p_cabin_id text default null)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_item public.catalog_items;
  v_loan public.loans;
begin
  select * into v_item from public.catalog_items i where i.id = p_item_id for update;
  if v_item.id is null then
    raise exception 'Výtisk nebyl nalezen.';
  end if;
  if not exists (
    select 1 from public.libraries l where l.id = v_item.library_id and l.loans_enabled
  ) then
    raise exception 'Tato knihovna teď nepůjčuje.';
  end if;
  if v_item.status <> 'available' then
    raise exception 'Výtisk není dostupný.';
  end if;
  -- Zámek profilu řadí souběžné žádosti téhož čtenáře, limit tak nejde obejít.
  perform 1 from public.profiles p where p.id = v_uid for update;
  if (
    select count(*) from public.loans l
    where l.reader_id = v_uid and l.status in ('requested', 'approved', 'picked_up')
  ) >= 5 then
    raise exception 'Najednou můžeš mít nejvýš 5 žádostí a výpůjček. Nejdřív nějakou knihu vrať.';
  end if;

  begin
    insert into public.loans (catalog_item_id, library_id, reader_id, note, cabin_id)
    values (v_item.id, v_item.library_id, v_uid, private.clean_note(p_note), nullif(btrim(p_cabin_id), ''))
    returning * into v_loan;
  exception when unique_violation then
    raise exception 'O tento výtisk už někdo požádal.';
  end;

  return v_loan;
end;
$$;

-- Odchod z knihovny. Správce odejde jen tehdy, když po něm zůstane jiný správce.
create function public.leave_library(p_library_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_role text;
begin
  select s.role into v_role
  from public.library_staff s
  where s.library_id = p_library_id and s.user_id = v_uid;
  if v_role is null then
    raise exception 'V této knihovně nejsi zaměstnanec.';
  end if;
  if v_role = 'admin' then
    perform private.assert_keeps_admin(p_library_id, v_uid);
  end if;

  delete from public.library_staff s
  where s.library_id = p_library_id and s.user_id = v_uid;
end;
$$;

revoke all on function public.leave_library(uuid) from public, anon, authenticated;
grant execute on function public.leave_library(uuid) to authenticated;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform private.require_app_admin();
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Účet neexistuje.';
  end if;

  select l.name into v_name
  from public.library_staff s
  join public.libraries l on l.id = s.library_id
  where s.user_id = p_user_id and s.role = 'admin'
    and not exists (
      select 1 from public.library_staff o
      where o.library_id = s.library_id and o.role = 'admin' and o.user_id <> p_user_id
    )
  limit 1;
  if v_name is not null then
    raise exception 'Účet je jediný správce knihovny %. Nejdřív smaž knihovnu nebo jmenuj jiného správce.', v_name;
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
