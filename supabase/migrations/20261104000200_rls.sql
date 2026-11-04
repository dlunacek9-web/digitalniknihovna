-- 2/3 Oprávnění: granty a Row Level Security.
-- Platí dvě nezávislé vrstvy. Granty určují, jaké operace a sloupce role vůbec smí,
-- RLS určuje, kterých řádků se týkají. Co tu není povolené, je zakázané.

-- Pomocné funkce musí být security definer: politika na library_staff by se jinak
-- při dotazu na library_staff volala rekurzivně. Ptají se jen na přihlášeného
-- uživatele, takže nejde zjišťovat členství cizích účtů.
create function private.is_staff(p_library_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_staff s
    where s.library_id = p_library_id and s.user_id = auth.uid()
  );
$$;

create function private.is_admin(p_library_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.library_staff s
    where s.library_id = p_library_id and s.user_id = auth.uid() and s.role = 'admin'
  );
$$;

-- Zaměstnanec vidí jméno kolegů a čtenářů, kteří mají výpůjčku v jeho knihovně.
create function private.can_see_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.library_staff me
    join public.library_staff them on them.library_id = me.library_id
    where me.user_id = auth.uid() and them.user_id = p_user_id
  ) or exists (
    select 1
    from public.library_staff me
    join public.loans l on l.library_id = me.library_id
    where me.user_id = auth.uid() and l.reader_id = p_user_id
  );
$$;

revoke all on function private.is_staff(uuid) from public;
revoke all on function private.is_admin(uuid) from public;
revoke all on function private.can_see_profile(uuid) from public;

-- Politiky se vyhodnocují pod rolí volajícího, proto authenticated potřebuje přístup
-- k těmto třem funkcím. Schéma private přitom API nevystavuje.
grant usage on schema private to authenticated;
grant execute on function private.is_staff(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.can_see_profile(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.libraries enable row level security;
alter table public.library_staff enable row level security;
alter table public.library_invites enable row level security;
alter table public.catalog_items enable row level security;
alter table public.loans enable row level security;

-- Starší projekty Supabase dávají novým tabulkám výchozí granty včetně TRUNCATE,
-- na který RLS neplatí. Proto se nejdřív všechno odebere a pak povolí jen to potřebné.
-- Role anon nedostane nic.
revoke all on table
  public.profiles,
  public.libraries,
  public.library_staff,
  public.library_invites,
  public.catalog_items,
  public.loans
from public, anon, authenticated;

-- profiles: vlastní profil, kolegové a čtenáři vlastní knihovny. Měnit jde jen vlastní jméno.
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.can_see_profile(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- libraries: čte každý přihlášený, nastavení mění jen admin dané knihovny.
-- Založení jde jen přes RPC create_library.
grant select on public.libraries to authenticated;
grant update (name, address, city, loans_enabled) on public.libraries to authenticated;

create policy libraries_select on public.libraries
  for select to authenticated
  using (true);

create policy libraries_update_admin on public.libraries
  for update to authenticated
  using (private.is_admin(id))
  with check (private.is_admin(id));

-- library_staff: čtou jen členové stejné knihovny. Zápis jde jen přes RPC,
-- jinak by si kdokoli mohl přidat vlastní řádek a stát se správcem.
grant select on public.library_staff to authenticated;

create policy library_staff_select on public.library_staff
  for select to authenticated
  using (private.is_staff(library_id));

-- library_invites: kód je tajemství, které dává přístup do knihovny, proto ho čte
-- jen admin. Zápis jde jen přes RPC.
grant select on public.library_invites to authenticated;

create policy library_invites_select_admin on public.library_invites
  for select to authenticated
  using (private.is_admin(library_id));

-- catalog_items: čte každý přihlášený, spravuje jen zaměstnanec dané knihovny.
-- Sloupce status a library_id v grantech nejsou: stav mění jen RPC, aby nešel
-- rozejít s výpůjčkami, a výtisk nejde přesunout do jiné knihovny.
grant select on public.catalog_items to authenticated;
grant insert (library_id, isbn, title, authors, publisher, year, cover_url, genre, inventory_number)
  on public.catalog_items to authenticated;
grant update (isbn, title, authors, publisher, year, cover_url, genre, inventory_number)
  on public.catalog_items to authenticated;
grant delete on public.catalog_items to authenticated;

create policy catalog_items_select on public.catalog_items
  for select to authenticated
  using (true);

create policy catalog_items_insert_staff on public.catalog_items
  for insert to authenticated
  with check (private.is_staff(library_id));

create policy catalog_items_update_staff on public.catalog_items
  for update to authenticated
  using (private.is_staff(library_id))
  with check (private.is_staff(library_id));

create policy catalog_items_delete_staff on public.catalog_items
  for delete to authenticated
  using (private.is_staff(library_id));

-- loans: čtenář vidí své, zaměstnanec výpůjčky své knihovny.
-- Klient do tabulky nezapisuje vůbec, založení i všechny změny stavu jdou přes RPC.
grant select on public.loans to authenticated;

create policy loans_select on public.loans
  for select to authenticated
  using (reader_id = (select auth.uid()) or private.is_staff(library_id));
