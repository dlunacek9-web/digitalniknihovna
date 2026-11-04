-- 1/3 Schéma: tabulky, omezení, indexy a trigger profilu.
-- Role uživatele se nikde neukládá: každý účet je čtenář, zaměstnanec je ten,
-- kdo má řádek v library_staff.

-- Interní funkce patří mimo schéma public, které Supabase vystavuje přes API.
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text check (char_length(address) <= 300),
  city text check (char_length(city) <= 100),
  loans_enabled boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.library_staff (
  library_id uuid not null references public.libraries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (library_id, user_id)
);
create index library_staff_user_id_idx on public.library_staff (user_id);

create table public.library_invites (
  code text primary key,
  library_id uuid not null references public.libraries (id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Použití určuje used_at: po smazání účtu se used_by vynuluje,
  -- ale kód se tím nesmí znovu stát platným.
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz
);
create index library_invites_library_id_idx on public.library_invites (library_id);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete restrict,
  isbn text check (char_length(isbn) <= 20),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  authors text check (char_length(authors) <= 500),
  publisher text check (char_length(publisher) <= 300),
  year integer check (year between 1 and 2100),
  -- Jen https: adresa se vykresluje čtenářům a 3D scéna z ní načítá texturu.
  cover_url text check (cover_url ~ '^https://' and char_length(cover_url) <= 1000),
  genre text check (char_length(genre) <= 100),
  status text not null default 'available'
    check (status in ('available', 'reserved', 'on_loan', 'unavailable')),
  inventory_number text check (char_length(inventory_number) <= 50),
  created_at timestamptz not null default now(),
  -- Cíl složeného cizího klíče z loans.
  unique (id, library_id)
);
create index catalog_items_library_id_idx on public.catalog_items (library_id);
create unique index catalog_items_inventory_number_key
  on public.catalog_items (library_id, inventory_number)
  where inventory_number is not null;

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null,
  library_id uuid not null,
  -- restrict: účet s historií výpůjček nejde smazat omylem.
  reader_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'picked_up', 'returned', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz,
  note text check (char_length(note) <= 500),
  -- Výpůjčka vždy patří do stejné knihovny jako její výtisk.
  -- restrict: výtisk s historií výpůjček nejde smazat, jen vyřadit.
  foreign key (catalog_item_id, library_id)
    references public.catalog_items (id, library_id) on delete restrict,
  check (status <> 'picked_up' or due_at is not null),
  check ((status = 'returned') = (returned_at is not null))
);
create index loans_library_id_status_idx on public.loans (library_id, status);
create index loans_reader_id_idx on public.loans (reader_id);
create index loans_catalog_item_id_idx on public.loans (catalog_item_id);

-- Žádné dvě aktivní žádosti na jeden výtisk. Platí i při souběhu, protože
-- pravidlo hlídá databáze, ne kód aplikace.
create unique index loans_one_active_per_item
  on public.loans (catalog_item_id)
  where status in ('requested', 'approved', 'picked_up');

-- Profil po registraci. Jméno pochází z metadat, která zadává uživatel, proto se
-- jen ořízne a nikdy se z něj nic neodvozuje. Email se do profilu nekopíruje,
-- aby ho knihovníci neviděli.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(left(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 100), 'Uživatel')
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
