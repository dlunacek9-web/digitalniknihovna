-- 3/3 RPC: operace, které mění vazby mezi tabulkami.
-- Funkce běží jako security definer, tedy mimo RLS. Oprávnění si proto každá
-- kontroluje sama a search_path = '' brání podstrčení objektů z cizího schématu.
-- Chyby P0001 jsou české zprávy pro uživatele, 42501 znamená chybějící oprávnění.

-- ---------- interní pomocníci (klient je volat nemůže) ----------

create function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Nejste přihlášeni.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create function private.clean_note(p_note text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(nullif(btrim(p_note), ''), 500);
$$;

-- Zamyká vždy nejdřív výtisk, potom výpůjčku. Pevné pořadí brání uváznutí
-- a kontrola stavu po zámku brání souběhu dvou knihovníků.
create function private.lock_loan(p_loan_id uuid)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
  v_loan public.loans;
begin
  select l.catalog_item_id into v_item_id from public.loans l where l.id = p_loan_id;
  if found then
    perform 1 from public.catalog_items i where i.id = v_item_id for update;
    select * into v_loan from public.loans l where l.id = p_loan_id for update;
  end if;
  return v_loan;
end;
$$;

-- Cizí i neexistující výpůjčka vrací stejnou chybu, aby nešlo zjišťovat cizí záznamy.
create function private.lock_loan_as_staff(p_loan_id uuid)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans := private.lock_loan(p_loan_id);
begin
  perform private.require_user();
  if v_loan.id is null or not private.is_staff(v_loan.library_id) then
    raise exception 'Výpůjčka nebyla nalezena.' using errcode = '42501';
  end if;
  return v_loan;
end;
$$;

-- Knihovna nesmí zůstat bez správce. Zámek knihovny řadí souběžné změny za sebe.
create function private.assert_keeps_admin(p_library_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.libraries l where l.id = p_library_id for update;
  if not exists (
    select 1 from public.library_staff s
    where s.library_id = p_library_id and s.role = 'admin' and s.user_id <> p_user_id
  ) then
    raise exception 'Knihovna musí mít alespoň jednoho správce.';
  end if;
end;
$$;

revoke all on function private.require_user() from public;
revoke all on function private.clean_note(text) from public;
revoke all on function private.lock_loan(uuid) from public;
revoke all on function private.lock_loan_as_staff(uuid) from public;
revoke all on function private.assert_keeps_admin(uuid, uuid) from public;

-- ---------- knihovna a zaměstnanci ----------

-- Založí knihovnu a zakladatele jako správce v jedné transakci.
create function public.create_library(p_name text, p_address text default null, p_city text default null)
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
    raise exception 'Už patříte do knihovny, další založit nemůžete.';
  end if;

  insert into public.libraries (name, address, city, created_by)
  values (btrim(p_name), nullif(btrim(p_address), ''), nullif(btrim(p_city), ''), v_uid)
  returning * into v_library;

  insert into public.library_staff (library_id, user_id, role)
  values (v_library.id, v_uid, 'admin');

  return v_library;
end;
$$;

create function public.create_invite(p_library_id uuid, p_role text default 'staff', p_valid_days integer default 7)
returns public.library_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_hex text := upper(replace(gen_random_uuid()::text, '-', ''));
  v_invite public.library_invites;
begin
  if not private.is_admin(p_library_id) then
    raise exception 'Pozvánky vytváří jen správce knihovny.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'Neplatná role.';
  end if;
  if p_valid_days not between 1 and 30 then
    raise exception 'Platnost pozvánky musí být 1 až 30 dní.';
  end if;

  -- 48 náhodných bitů z UUID v4: kód nejde uhodnout zkoušením.
  insert into public.library_invites (code, library_id, role, created_by, expires_at)
  values (
    substr(v_hex, 1, 4) || '-' || substr(v_hex, 5, 4) || '-' || substr(v_hex, 9, 4),
    p_library_id,
    p_role,
    v_uid,
    now() + make_interval(days => p_valid_days)
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create function public.revoke_invite(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_library_id uuid;
begin
  perform private.require_user();
  select i.library_id into v_library_id from public.library_invites i where i.code = p_code;
  if v_library_id is null or not private.is_admin(v_library_id) then
    raise exception 'Pozvánka nebyla nalezena.' using errcode = '42501';
  end if;
  delete from public.library_invites i where i.code = p_code and i.used_at is null;
  if not found then
    raise exception 'Použitou pozvánku nejde zrušit.';
  end if;
end;
$$;

-- Kód je jednorázový: řádek se zamkne, takže ho nejde uplatnit dvakrát souběžně.
-- Neplatný, použitý i prošlý kód vrací stejnou chybu.
create function public.redeem_invite(p_code text)
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
    raise exception 'V této knihovně už jste zaměstnancem.';
  end if;

  insert into public.library_staff (library_id, user_id, role)
  values (v_invite.library_id, v_uid, v_invite.role);

  update public.library_invites i
  set used_by = v_uid, used_at = now()
  where i.code = v_invite.code;

  return v_invite.library_id;
end;
$$;

create function public.set_staff_role(p_library_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if not private.is_admin(p_library_id) then
    raise exception 'Zaměstnance spravuje jen správce knihovny.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'Neplatná role.';
  end if;
  if p_role = 'staff' then
    perform private.assert_keeps_admin(p_library_id, p_user_id);
  end if;

  update public.library_staff s
  set role = p_role
  where s.library_id = p_library_id and s.user_id = p_user_id;
  if not found then
    raise exception 'Zaměstnanec nebyl nalezen.';
  end if;
end;
$$;

create function public.remove_staff(p_library_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if not private.is_admin(p_library_id) then
    raise exception 'Zaměstnance spravuje jen správce knihovny.' using errcode = '42501';
  end if;
  perform private.assert_keeps_admin(p_library_id, p_user_id);

  delete from public.library_staff s
  where s.library_id = p_library_id and s.user_id = p_user_id;
  if not found then
    raise exception 'Zaměstnanec nebyl nalezen.';
  end if;
end;
$$;

-- ---------- výtisk ----------

-- Vyřazení a návrat do oběhu. Stavy reserved a on_loan nastavuje jen životní cyklus výpůjčky.
create function public.set_item_status(p_item_id uuid, p_status text)
returns public.catalog_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.catalog_items;
begin
  perform private.require_user();
  select * into v_item from public.catalog_items i where i.id = p_item_id for update;
  if v_item.id is null or not private.is_staff(v_item.library_id) then
    raise exception 'Výtisk nebyl nalezen.' using errcode = '42501';
  end if;
  if p_status not in ('available', 'unavailable') then
    raise exception 'Tento stav nastavuje jen výpůjčka.';
  end if;
  if exists (
    select 1 from public.loans l
    where l.catalog_item_id = p_item_id and l.status in ('requested', 'approved', 'picked_up')
  ) then
    raise exception 'Výtisk má aktivní žádost nebo výpůjčku.';
  end if;

  update public.catalog_items i set status = p_status where i.id = p_item_id
  returning * into v_item;
  return v_item;
end;
$$;

-- ---------- životní cyklus výpůjčky ----------
-- requested -> approved -> picked_up -> returned
-- requested -> cancelled (čtenář) | rejected (knihovník)
-- approved  -> rejected (knihovník, čtenář si knihu nevyzvedl)
--
-- Stav výtisku: žádost ho nemění, schválení = reserved, předání = on_loan,
-- vrácení i odmítnutí schválené výpůjčky = available.

-- Čtenář a knihovna se berou ze serveru, klient je nemůže podvrhnout.
create function public.request_loan(p_item_id uuid, p_note text default null)
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

  begin
    insert into public.loans (catalog_item_id, library_id, reader_id, note)
    values (v_item.id, v_item.library_id, v_uid, private.clean_note(p_note))
    returning * into v_loan;
  exception when unique_violation then
    raise exception 'O tento výtisk už někdo požádal.';
  end;

  return v_loan;
end;
$$;

create function public.cancel_loan(p_loan_id uuid)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_loan public.loans := private.lock_loan(p_loan_id);
begin
  if v_loan.id is null or v_loan.reader_id <> v_uid then
    raise exception 'Výpůjčka nebyla nalezena.' using errcode = '42501';
  end if;
  if v_loan.status <> 'requested' then
    raise exception 'Vyřízenou žádost už nejde zrušit.';
  end if;

  update public.loans l set status = 'cancelled' where l.id = p_loan_id
  returning * into v_loan;
  return v_loan;
end;
$$;

create function public.approve_loan(p_loan_id uuid)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans := private.lock_loan_as_staff(p_loan_id);
begin
  if v_loan.status <> 'requested' then
    raise exception 'Schválit jde jen čekající žádost.';
  end if;

  update public.catalog_items i set status = 'reserved' where i.id = v_loan.catalog_item_id;
  update public.loans l set status = 'approved' where l.id = p_loan_id
  returning * into v_loan;
  return v_loan;
end;
$$;

create function public.reject_loan(p_loan_id uuid, p_note text default null)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans := private.lock_loan_as_staff(p_loan_id);
begin
  if v_loan.status not in ('requested', 'approved') then
    raise exception 'Odmítnout jde jen čekající nebo schválenou žádost.';
  end if;

  if v_loan.status = 'approved' then
    update public.catalog_items i set status = 'available' where i.id = v_loan.catalog_item_id;
  end if;
  update public.loans l
  set status = 'rejected', note = coalesce(private.clean_note(p_note), l.note)
  where l.id = p_loan_id
  returning * into v_loan;
  return v_loan;
end;
$$;

-- Bez zadaného termínu se půjčuje na 30 dní.
create function public.pickup_loan(p_loan_id uuid, p_due_at timestamptz default null)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans := private.lock_loan_as_staff(p_loan_id);
  v_due_at timestamptz := coalesce(p_due_at, now() + interval '30 days');
begin
  if v_loan.status <> 'approved' then
    raise exception 'Předat jde jen schválenou žádost.';
  end if;
  if v_due_at <= now() then
    raise exception 'Termín vrácení musí být v budoucnu.';
  end if;

  update public.catalog_items i set status = 'on_loan' where i.id = v_loan.catalog_item_id;
  update public.loans l set status = 'picked_up', due_at = v_due_at where l.id = p_loan_id
  returning * into v_loan;
  return v_loan;
end;
$$;

create function public.return_loan(p_loan_id uuid)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans := private.lock_loan_as_staff(p_loan_id);
begin
  if v_loan.status <> 'picked_up' then
    raise exception 'Vrátit jde jen předanou knihu.';
  end if;

  update public.catalog_items i set status = 'available' where i.id = v_loan.catalog_item_id;
  update public.loans l set status = 'returned', returned_at = now() where l.id = p_loan_id
  returning * into v_loan;
  return v_loan;
end;
$$;

-- ---------- oprávnění ke spuštění ----------
-- Postgres dává EXECUTE automaticky roli PUBLIC a Supabase může přidat i anon.
-- Každá funkce se proto zamkne jednotlivě a povolí jen přihlášeným.
do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.create_library(text, text, text)',
    'public.create_invite(uuid, text, integer)',
    'public.revoke_invite(text)',
    'public.redeem_invite(text)',
    'public.set_staff_role(uuid, uuid, text)',
    'public.remove_staff(uuid, uuid)',
    'public.set_item_status(uuid, text)',
    'public.request_loan(uuid, text)',
    'public.cancel_loan(uuid)',
    'public.approve_loan(uuid)',
    'public.reject_loan(uuid, text)',
    'public.pickup_loan(uuid, timestamptz)',
    'public.return_loan(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to authenticated', v_signature);
  end loop;
end;
$$;
