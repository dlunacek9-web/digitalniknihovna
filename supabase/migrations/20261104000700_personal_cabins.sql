-- Osobní chaty a knihy čtenáře žijí v databázi u účtu, ne v prohlížeči.
-- Každý řádek patří jednomu uživateli a vidí ho jen on (RLS).

create table public.cabins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index cabins_user_id_idx on public.cabins (user_id);

create table public.cabin_books (
  id uuid primary key default gen_random_uuid(),
  cabin_id uuid not null references public.cabins (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  authors text check (char_length(authors) <= 500),
  isbn text check (char_length(isbn) <= 20),
  -- Ostatní údaje knihy (nakladatel, obálka, žánr, stav čtení, výpůjčka ...).
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 20000),
  created_at timestamptz not null default now()
);
create index cabin_books_cabin_id_idx on public.cabin_books (cabin_id);
create index cabin_books_user_id_idx on public.cabin_books (user_id);

-- Nastavení aplikace u účtu (aktivní chata, tutoriál, režim skenování ...).
alter table public.profiles
  add column settings jsonb not null default '{}'::jsonb
  check (pg_column_size(settings) <= 2000);

alter table public.cabins enable row level security;
alter table public.cabin_books enable row level security;

revoke all on table public.cabins, public.cabin_books from public, anon, authenticated;

grant select, insert, delete on public.cabins to authenticated;
grant update (name) on public.cabins to authenticated;
grant select, insert, delete on public.cabin_books to authenticated;
grant update (title, authors, isbn, data) on public.cabin_books to authenticated;
grant update (settings) on public.profiles to authenticated;

create policy cabins_own_select on public.cabins
  for select to authenticated using (user_id = (select auth.uid()));
create policy cabins_own_insert on public.cabins
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy cabins_own_update on public.cabins
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cabins_own_delete on public.cabins
  for delete to authenticated using (user_id = (select auth.uid()));

-- Kniha smí do chaty, která patří témuž uživateli.
create policy cabin_books_own_select on public.cabin_books
  for select to authenticated using (user_id = (select auth.uid()));
create policy cabin_books_own_insert on public.cabin_books
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.cabins c where c.id = cabin_id and c.user_id = (select auth.uid()))
  );
create policy cabin_books_own_update on public.cabin_books
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cabin_books_own_delete on public.cabin_books
  for delete to authenticated using (user_id = (select auth.uid()));

-- Jedna výpůjčka z knihovny smí v chatách stát jen jednou, i při souběhu dvou zařízení.
create unique index cabin_books_one_per_loan
  on public.cabin_books (user_id, ((data -> 'library_loan') ->> 'id'))
  where (data -> 'library_loan') ->> 'id' is not null;
