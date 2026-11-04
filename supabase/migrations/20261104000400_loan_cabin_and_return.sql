-- Čtenář si při žádosti vybere chatu, do které se kniha po schválení přesune,
-- a půjčenou knihu může nahlásit k vrácení. Převzetí dál potvrzuje knihovník (return_loan).

-- Chaty žijí jen v prohlížeči čtenáře, proto cabin_id není cizí klíč.
alter table public.loans
  add column cabin_id text check (char_length(cabin_id) <= 100),
  add column return_requested_at timestamptz;

drop function public.request_loan(uuid, text);

-- Čtenář a knihovna se berou ze serveru, klient je nemůže podvrhnout.
create function public.request_loan(p_item_id uuid, p_note text default null, p_cabin_id text default null)
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
    insert into public.loans (catalog_item_id, library_id, reader_id, note, cabin_id)
    values (v_item.id, v_item.library_id, v_uid, private.clean_note(p_note), nullif(btrim(p_cabin_id), ''))
    returning * into v_loan;
  exception when unique_violation then
    raise exception 'O tento výtisk už někdo požádal.';
  end;

  return v_loan;
end;
$$;

-- Stav výpůjčky se nemění: kniha je u čtenáře, dokud převzetí nepotvrdí knihovník.
create function public.request_return(p_loan_id uuid)
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
  if v_loan.status <> 'picked_up' then
    raise exception 'Vrátit jde jen předanou knihu.';
  end if;
  if v_loan.return_requested_at is not null then
    raise exception 'O vrácení už je požádáno.';
  end if;

  update public.loans l set return_requested_at = now() where l.id = p_loan_id
  returning * into v_loan;
  return v_loan;
end;
$$;

revoke all on function public.request_loan(uuid, text, text) from public, anon, authenticated;
grant execute on function public.request_loan(uuid, text, text) to authenticated;
revoke all on function public.request_return(uuid) from public, anon, authenticated;
grant execute on function public.request_return(uuid) to authenticated;
