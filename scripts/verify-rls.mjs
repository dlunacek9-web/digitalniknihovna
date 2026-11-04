// Ověří migrace a oprávnění na skutečném Postgresu (PGlite, běží bez Dockeru).
// Spuštění: npm run verify:rls
//
// Supabase se tu napodobuje v horším případě: role anon a authenticated, starší výchozí
// granty na všechno ve schématu public a vlastník migrací bez práv superuživatele.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const db = new PGlite();

let passed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
  } else {
    failures.push(name);
    console.error(`  NEPROŠLO: ${name}${detail ? ` (${detail})` : ''}`);
  }
}

async function bootstrap() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create role supabase_auth_admin nologin;
    create role migrator nologin nosuperuser;

    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb,
      email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;

    grant usage on schema auth to anon, authenticated, service_role, migrator, supabase_auth_admin;
    grant execute on function auth.uid() to public;
    grant insert on auth.users to supabase_auth_admin;
    grant references, trigger, select, delete on auth.users to migrator;

    grant usage, create on schema public to migrator;
    grant usage on schema public to anon, authenticated, service_role;
    grant create on database postgres to migrator;

    alter default privileges for role migrator in schema public
      grant all on tables to anon, authenticated, service_role;
    alter default privileges for role migrator in schema public
      grant all on functions to anon, authenticated, service_role;
  `);

  await db.exec('set role migrator');
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  await db.exec('reset role');
}

// Dotaz jako přihlášený uživatel (uid) nebo anonym (null). Běží v transakci, stejně jako v API.
async function as(uid, sql, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid } : {})]);
    const result = await db.query(sql, params);
    await db.exec('commit');
    return result.rows;
  } catch (err) {
    await db.exec('rollback');
    throw err;
  }
}

async function denied(name, uid, sql, params = [], pattern = null) {
  try {
    const rows = await as(uid, sql, params);
    check(name, false, `prošlo, vrátilo ${rows.length} řádků`);
  } catch (err) {
    check(name, !pattern || pattern.test(err.message), err.message);
  }
}

async function noRows(name, uid, sql, params = []) {
  try {
    const rows = await as(uid, sql, params);
    check(name, rows.length === 0, `vrátilo ${rows.length} řádků`);
  } catch (err) {
    // Chyba oprávnění je stejně dobrá jako prázdný výsledek.
    check(name, /permission denied/.test(err.message), err.message);
  }
}

async function one(uid, sql, params = []) {
  const rows = await as(uid, sql, params);
  return rows[0];
}

const itemStatus = async (id) => (await db.query('select status from public.catalog_items where id = $1', [id])).rows[0].status;

let userCounter = 0;
async function createUser(name) {
  userCounter += 1;
  const id = `00000000-0000-4000-8000-${String(userCounter).padStart(12, '0')}`;
  await db.exec('set role supabase_auth_admin');
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `user${userCounter}@example.test`,
    JSON.stringify(name === undefined ? {} : { name })
  ]);
  await db.exec('reset role');
  return id;
}

async function structure() {
  console.log('Struktura a granty');
  const tables = (await db.query(`
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  `)).rows;
  check('ve schématu public je právě 8 tabulek', tables.length === 8, tables.map((t) => t.relname).join());
  for (const t of tables) {
    check(`RLS je zapnuté: ${t.relname}`, t.relrowsecurity === true);
    for (const priv of ['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) {
      const { has } = (await db.query(`select has_table_privilege('anon', $1, $2) as has`, [`public.${t.relname}`, priv])).rows[0];
      check(`anon nemá ${priv} na ${t.relname}`, has === false);
    }
    const { has } = (await db.query(`select has_table_privilege('authenticated', $1, 'truncate') as has`, [`public.${t.relname}`])).rows[0];
    check(`authenticated nemá truncate na ${t.relname}`, has === false);
  }

  const functions = (await db.query(`
    select n.nspname, p.proname, p.oid::regprocedure::text as signature, p.prosecdef, p.proconfig,
           has_function_privilege('anon', p.oid, 'execute') as anon_exec,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
  `)).rows;
  const allowedPrivate = ['is_staff', 'is_admin', 'can_see_profile'];
  check('migrace vytvořily funkce', functions.length >= 20, String(functions.length));
  for (const f of functions) {
    check(`anon nespustí ${f.signature}`, f.anon_exec === false);
    if (f.prosecdef) check(`${f.signature} má pevný search_path`, (f.proconfig || []).some((c) => c.startsWith('search_path=')));
    if (f.nspname === 'private' && !allowedPrivate.includes(f.proname)) {
      check(`authenticated nespustí interní ${f.signature}`, f.auth_exec === false);
    }
  }
}

async function main() {
  await bootstrap();
  await structure();

  console.log('Profily');
  const adminA = await createUser('Správce A');
  const adminB = await createUser('Správce B');
  const staffA = await createUser('Kolega A');
  const reader1 = await createUser('Čtenář 1');
  const reader2 = await createUser('Čtenář 2');
  const noName = await createUser();
  check('trigger založil profil', (await one(reader1, 'select name from public.profiles where id = $1', [reader1])).name === 'Čtenář 1');
  check('profil bez jména má náhradní', (await one(noName, 'select name from public.profiles where id = $1', [noName])).name === 'Uživatel');
  await noRows('čtenář nevidí cizí profil', reader2, 'select * from public.profiles where id = $1', [reader1]);
  await noRows('čtenář nezmění cizí jméno', reader2, `update public.profiles set name = 'x' where id = $1 returning id`, [reader1]);
  await denied('uživatel si nezmění id profilu', reader1, 'update public.profiles set id = $1 where id = $2 returning id', [reader2, reader1]);
  check('čtenář změní své jméno', (await one(reader2, `update public.profiles set name = 'Čtenář 2' where id = $1 returning name`, [reader2])).name === 'Čtenář 2');

  console.log('Anonymní uživatel');
  for (const table of ['profiles', 'libraries', 'library_staff', 'library_invites', 'catalog_items', 'loans']) {
    await denied(`anon nepřečte ${table}`, null, `select * from public.${table}`, [], /permission denied/);
  }
  await denied('anon nezaloží knihovnu', null, `select public.create_library('X')`, [], /permission denied/);
  await denied('anon neuplatní pozvánku', null, `select public.redeem_invite('X')`, [], /permission denied/);

  console.log('Knihovny');
  const libA = await one(adminA, `select * from public.create_library('Školní knihovna A', 'Ulice 1', 'Praha')`);
  const libB = await one(adminB, `select * from public.create_library('Knihovna B')`);
  check('nová knihovna nepůjčuje', libA.loans_enabled === false);
  check('zakladatel je admin', (await one(adminA, 'select role from public.library_staff where library_id = $1', [libA.id])).role === 'admin');
  await denied('admin nezaloží druhou knihovnu', adminA, `select public.create_library('Další')`);
  await denied('přímý insert do libraries je zakázán', reader1, `insert into public.libraries (name) values ('x')`, [], /permission denied/);
  await denied('nelze si přidat řádek do library_staff', reader1, `insert into public.library_staff (library_id, user_id, role) values ($1, $2, 'admin')`, [libA.id, reader1], /permission denied/);
  await denied('admin si nepřímo nezmění roli', adminB, `update public.library_staff set role = 'admin' where library_id = $1`, [libA.id], /permission denied/);
  await denied('created_by nejde změnit', adminA, 'update public.libraries set created_by = $1 where id = $2', [reader1, libA.id], /permission denied/);
  await noRows('admin jiné knihovny nezmění nastavení', adminB, 'update public.libraries set loans_enabled = true where id = $1 returning id', [libA.id]);
  await noRows('čtenář nezmění nastavení', reader1, 'update public.libraries set loans_enabled = true where id = $1 returning id', [libA.id]);
  check('čtenář vidí všechny knihovny', (await as(reader1, 'select id from public.libraries')).length === 2);

  console.log('Pozvánky a zaměstnanci');
  await denied('čtenář nevytvoří pozvánku', reader1, 'select public.create_invite($1)', [libA.id], /Pozvánky vytváří/);
  await denied('admin B nevytvoří pozvánku do A', adminB, 'select public.create_invite($1)', [libA.id], /Pozvánky vytváří/);
  const invite = await one(adminA, 'select * from public.create_invite($1)', [libA.id]);
  check('kód má formát XXXX-XXXX-XXXX', /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(invite.code), invite.code);
  await noRows('čtenář nepřečte pozvánky', reader1, 'select * from public.library_invites');
  await noRows('admin B nepřečte pozvánky A', adminB, 'select * from public.library_invites where library_id = $1', [libA.id]);
  await denied('kód nejde uplatnit bez platného kódu', staffA, `select public.redeem_invite('AAAA-AAAA-AAAA')`, [], /neplatný/);
  check('malá písmena a mezery v kódu nevadí', (await one(staffA, 'select public.redeem_invite($1) as id', [` ${invite.code.toLowerCase()} `])).id === libA.id);
  check('uplatněním vznikne role staff', (await one(staffA, 'select role from public.library_staff where user_id = $1', [staffA])).role === 'staff');
  await denied('kód nejde použít podruhé', reader1, 'select public.redeem_invite($1)', [invite.code], /neplatný/);
  await noRows('zaměstnanec nepřečte pozvánky', staffA, 'select * from public.library_invites');
  await denied('zaměstnanec nevytvoří pozvánku', staffA, 'select public.create_invite($1)', [libA.id], /Pozvánky vytváří/);

  const expired = await one(adminA, 'select * from public.create_invite($1)', [libA.id]);
  await db.query(`update public.library_invites set expires_at = now() - interval '1 minute' where code = $1`, [expired.code]);
  await denied('prošlý kód nejde použít', reader1, 'select public.redeem_invite($1)', [expired.code], /neplatný/);

  const toRevoke = await one(adminA, 'select * from public.create_invite($1)', [libA.id]);
  await denied('zaměstnanec nezruší pozvánku', staffA, 'select public.revoke_invite($1)', [toRevoke.code]);
  await as(adminA, 'select public.revoke_invite($1)', [toRevoke.code]);
  await denied('zrušený kód nejde použít', reader1, 'select public.redeem_invite($1)', [toRevoke.code], /neplatný/);

  const adminInvite = await one(adminA, `select * from public.create_invite($1, 'admin')`, [libA.id]);
  await denied('člen si kódem nezvýší roli', staffA, 'select public.redeem_invite($1)', [adminInvite.code], /už jste/);
  await as(adminA, 'select public.revoke_invite($1)', [adminInvite.code]);

  await denied('zaměstnanec nemění role', staffA, `select public.set_staff_role($1, $2, 'admin')`, [libA.id, staffA], /jen správce/);
  await denied('admin B nemění role v A', adminB, `select public.set_staff_role($1, $2, 'admin')`, [libA.id, adminB], /jen správce/);
  await denied('poslední admin se nezbaví role', adminA, `select public.set_staff_role($1, $2, 'staff')`, [libA.id, adminA], /alespoň jednoho/);
  await denied('poslední admin nejde odebrat', adminA, 'select public.remove_staff($1, $2)', [libA.id, adminA], /alespoň jednoho/);
  await noRows('čtenář nevidí zaměstnance', reader1, 'select * from public.library_staff');
  await noRows('admin B nevidí zaměstnance A', adminB, 'select * from public.library_staff where library_id = $1', [libA.id]);
  check('kolega vidí kolegu', (await as(staffA, 'select user_id from public.library_staff')).length === 2);
  check('kolega vidí jméno kolegy', (await as(staffA, 'select name from public.profiles where id = $1', [adminA])).length === 1);

  console.log('Katalog');
  const insertItem = `insert into public.catalog_items (library_id, title, inventory_number) values ($1, $2, $3) returning *`;
  const item = await one(staffA, insertItem, [libA.id, 'Babička', 'INV-1']);
  const item2 = await one(adminA, insertItem, [libA.id, 'Krysař', 'INV-2']);
  const itemB = await one(adminB, insertItem, [libB.id, 'Kniha B', null]);
  check('nový výtisk je available', item.status === 'available');
  await denied('stejné inventární číslo je zakázané', adminA, insertItem, [libA.id, 'Dup', 'INV-1'], /duplicate key/);
  await denied('admin B nepřidá do A', adminB, insertItem, [libA.id, 'x', null], /row-level security/);
  await denied('čtenář nepřidá do katalogu', reader1, insertItem, [libA.id, 'x', null], /row-level security/);
  await denied('insert se stavem je zakázaný', adminA, `insert into public.catalog_items (library_id, title, status) values ($1, 'x', 'on_loan')`, [libA.id], /permission denied/);
  await denied('nejde vložit adresu jiná než https', adminA, `insert into public.catalog_items (library_id, title, cover_url) values ($1, 'x', 'javascript:alert(1)')`, [libA.id], /check constraint/);
  await noRows('admin B nezmění výtisk A', adminB, `update public.catalog_items set title = 'x' where id = $1 returning id`, [item.id]);
  await noRows('čtenář nezmění výtisk', reader1, `update public.catalog_items set title = 'x' where id = $1 returning id`, [item.id]);
  await noRows('admin B nesmaže výtisk A', adminB, 'delete from public.catalog_items where id = $1 returning id', [item.id]);
  await noRows('čtenář nesmaže výtisk', reader1, 'delete from public.catalog_items where id = $1 returning id', [item.id]);
  await denied('stav výtisku nejde měnit přímo', adminA, `update public.catalog_items set status = 'on_loan' where id = $1`, [item.id], /permission denied/);
  await denied('výtisk nejde přesunout do jiné knihovny', adminA, 'update public.catalog_items set library_id = $1 where id = $2', [libB.id, item.id], /permission denied/);
  check('zaměstnanec upraví výtisk', (await one(staffA, `update public.catalog_items set genre = 'Klasika' where id = $1 returning genre`, [item.id])).genre === 'Klasika');
  const spare = await one(staffA, insertItem, [libA.id, 'Výtisk ke smazání', 'SMAZAT-1']);
  check('zaměstnanec smaže výtisk bez výpůjček', (await as(staffA, 'delete from public.catalog_items where id = $1 returning id', [spare.id])).length === 1);
  check('čtenář čte katalog všech knihoven', (await as(reader1, 'select id from public.catalog_items')).length === 3);
  await denied('admin B nevyřadí výtisk A', adminB, `select public.set_item_status($1, 'unavailable')`, [item.id]);
  await denied('stav on_loan nejde nastavit ručně', adminA, `select public.set_item_status($1, 'on_loan')`, [item.id], /jen výpůjčka/);

  console.log('Životní cyklus výpůjčky');
  await denied('knihovna bez půjčování žádost odmítne', reader1, 'select public.request_loan($1)', [item.id], /nepůjčuje/);
  await as(adminA, 'update public.libraries set loans_enabled = true where id = $1', [libA.id]);
  await denied('přímý insert do loans je zakázán', reader1, `insert into public.loans (catalog_item_id, library_id, reader_id) values ($1, $2, $3)`, [item.id, libA.id, reader1], /permission denied/);

  const loan = await one(reader1, 'select * from public.request_loan($1, $2, $3)', [item.id, '  prosím  ', ' lib_1 ']);
  check('žádost si pamatuje zvolenou chatu', loan.cabin_id === 'lib_1');
  await denied('vrácení nejde nahlásit před předáním', reader1, 'select public.request_return($1)', [loan.id], /Vrátit/);
  check('žádost patří volajícímu', loan.reader_id === reader1 && loan.status === 'requested' && loan.library_id === libA.id);
  check('poznámka je oříznutá', loan.note === 'prosím');
  await denied('druhý čtenář nepožádá o stejný výtisk', reader2, 'select public.request_loan($1)', [item.id], /už někdo/);
  await denied('stejný čtenář nepožádá dvakrát', reader1, 'select public.request_loan($1)', [item.id], /už někdo/);
  await noRows('čtenář nevidí cizí výpůjčku', reader2, 'select * from public.loans where id = $1', [loan.id]);
  check('čtenář vidí jen své výpůjčky', (await as(reader2, 'select id from public.loans')).length === 0);
  await noRows('knihovník jiné knihovny nevidí výpůjčku', adminB, 'select * from public.loans where id = $1', [loan.id]);
  await noRows('knihovník jiné knihovny nevidí jméno čtenáře', adminB, 'select * from public.profiles where id = $1', [reader1]);
  check('knihovník vidí výpůjčku své knihovny', (await as(staffA, 'select id from public.loans where id = $1', [loan.id])).length === 1);
  check('knihovník vidí jméno čtenáře', (await as(staffA, 'select name from public.profiles where id = $1', [reader1])).length === 1);
  check('žádost nemění stav výtisku', (await itemStatus(item.id)) === 'available');

  await denied('přímý update loans je zakázán', reader1, `update public.loans set status = 'returned' where id = $1`, [loan.id], /permission denied/);
  await denied('přímý delete loans je zakázán', adminA, 'delete from public.loans where id = $1', [loan.id], /permission denied/);
  await denied('cizí čtenář nezruší žádost', reader2, 'select public.cancel_loan($1)', [loan.id], /nebyla nalezena/);
  await denied('knihovník jiné knihovny neschválí', adminB, 'select public.approve_loan($1)', [loan.id], /nebyla nalezena/);
  await denied('čtenář si sám neschválí', reader1, 'select public.approve_loan($1)', [loan.id], /nebyla nalezena/);
  await denied('knihovník jiné knihovny neodmítne', adminB, 'select public.reject_loan($1)', [loan.id], /nebyla nalezena/);
  await denied('předat nejde bez schválení', staffA, 'select public.pickup_loan($1)', [loan.id], /Předat/);
  await denied('vrátit nejde bez předání', staffA, 'select public.return_loan($1)', [loan.id], /Vrátit/);
  await denied('výtisk s žádostí nejde vyřadit', staffA, `select public.set_item_status($1, 'unavailable')`, [item.id], /aktivní/);
  await denied('výtisk s výpůjčkou nejde smazat', staffA, 'delete from public.catalog_items where id = $1', [item.id], /foreign key/);

  await as(staffA, 'select public.approve_loan($1)', [loan.id]);
  check('schválení rezervuje výtisk', (await itemStatus(item.id)) === 'reserved');
  await denied('schválit nejde dvakrát', staffA, 'select public.approve_loan($1)', [loan.id], /Schválit/);
  await denied('schválenou žádost čtenář nezruší', reader1, 'select public.cancel_loan($1)', [loan.id], /Vyřízenou/);
  await denied('termín v minulosti je zakázaný', staffA, `select public.pickup_loan($1, now() - interval '1 day')`, [loan.id], /budoucnu/);
  await denied('knihovník jiné knihovny nepředá', adminB, 'select public.pickup_loan($1)', [loan.id], /nebyla nalezena/);

  const picked = await one(staffA, 'select * from public.pickup_loan($1)', [loan.id]);
  check('předání nastaví termín', picked.status === 'picked_up' && picked.due_at !== null);
  check('předání změní výtisk na on_loan', (await itemStatus(item.id)) === 'on_loan');
  await denied('půjčený výtisk nejde žádat', reader2, 'select public.request_loan($1)', [item.id], /není dostupný/);
  await denied('knihovník jiné knihovny nevrátí', adminB, 'select public.return_loan($1)', [loan.id], /nebyla nalezena/);
  await denied('cizí čtenář nenahlásí vrácení', reader2, 'select public.request_return($1)', [loan.id], /nebyla nalezena/);
  await denied('knihovník nenahlásí vrácení za čtenáře', adminA, 'select public.request_return($1)', [loan.id], /nebyla nalezena/);
  await denied('čtenář si nepotvrdí převzetí sám', reader1, 'select public.return_loan($1)', [loan.id], /nebyla nalezena/);
  const returning = await one(reader1, 'select * from public.request_return($1)', [loan.id]);
  check('nahlášené vrácení nemění stav výpůjčky', returning.status === 'picked_up' && returning.return_requested_at !== null);
  check('nahlášené vrácení nechá výtisk půjčený', (await itemStatus(item.id)) === 'on_loan');
  check('knihovník vidí nahlášené vrácení', (await one(staffA, 'select return_requested_at from public.loans where id = $1', [loan.id])).return_requested_at !== null);
  await denied('vrácení nejde nahlásit dvakrát', reader1, 'select public.request_return($1)', [loan.id], /už je požádáno/);

  const returned = await one(adminA, 'select * from public.return_loan($1)', [loan.id]);
  check('vrácení uloží čas', returned.status === 'returned' && returned.returned_at !== null);
  check('vrácení uvolní výtisk', (await itemStatus(item.id)) === 'available');
  await denied('vrátit nejde dvakrát', adminA, 'select public.return_loan($1)', [loan.id], /Vrátit/);
  await denied('výtisk s historií nejde smazat', adminA, 'delete from public.catalog_items where id = $1', [item.id], /foreign key/);

  const cancelled = await one(reader2, 'select * from public.request_loan($1)', [item.id]);
  check('uvolněný výtisk jde znovu žádat', cancelled.status === 'requested');
  check('čtenář zruší svou žádost', (await one(reader2, 'select * from public.cancel_loan($1)', [cancelled.id])).status === 'cancelled');
  check('zrušení nechá výtisk dostupný', (await itemStatus(item.id)) === 'available');

  const rejected = await one(reader1, 'select * from public.request_loan($1, $2)', [item2.id, 'původní']);
  check('odmítnutí bez důvodu zachová poznámku', (await one(staffA, 'select * from public.reject_loan($1)', [rejected.id])).note === 'původní');
  check('odmítnutá žádost nechá výtisk dostupný', (await itemStatus(item2.id)) === 'available');

  const noShow = await one(reader1, 'select * from public.request_loan($1)', [item2.id]);
  await as(staffA, 'select public.approve_loan($1)', [noShow.id]);
  check('odmítnutí schválené žádosti uloží důvod', (await one(staffA, 'select * from public.reject_loan($1, $2)', [noShow.id, 'nevyzvednuto'])).note === 'nevyzvednuto');
  check('odmítnutí schválené žádosti uvolní výtisk', (await itemStatus(item2.id)) === 'available');

  const active = await one(reader1, 'select * from public.request_loan($1)', [item2.id]);
  let uniqueBlocked = false;
  try {
    await db.query('insert into public.loans (catalog_item_id, library_id, reader_id) values ($1, $2, $3)', [item2.id, libA.id, reader2]);
  } catch (err) {
    uniqueBlocked = /loans_one_active_per_item/.test(err.message);
  }
  check('unikátní index blokuje druhou aktivní žádost i mimo RPC', uniqueBlocked);
  await as(reader1, 'select public.cancel_loan($1)', [active.id]);

  await as(adminB, 'update public.libraries set loans_enabled = true where id = $1', [libB.id]);
  const loanB = await one(reader2, 'select * from public.request_loan($1)', [itemB.id]);
  await noRows('knihovník A nevidí výpůjčky B', staffA, 'select * from public.loans where id = $1', [loanB.id]);
  await denied('knihovník A neschválí výpůjčku B', staffA, 'select public.approve_loan($1)', [loanB.id], /nebyla nalezena/);

  let crossLibraryBlocked = false;
  try {
    await db.query('insert into public.loans (catalog_item_id, library_id, reader_id) values ($1, $2, $3)', [item.id, libB.id, reader1]);
  } catch (err) {
    crossLibraryBlocked = /foreign key/.test(err.message);
  }
  check('výpůjčka nemůže ukazovat na výtisk jiné knihovny', crossLibraryBlocked);

  console.log('Odebrání zaměstnance');
  await denied('zaměstnanec nikoho neodebere', staffA, 'select public.remove_staff($1, $2)', [libA.id, adminA], /jen správce/);
  await as(adminA, 'select public.remove_staff($1, $2)', [libA.id, staffA]);
  await noRows('odebraný zaměstnanec ztratí přístup k výpůjčkám', staffA, 'select * from public.loans');
  await noRows('odebraný zaměstnanec nezmění katalog', staffA, `update public.catalog_items set title = 'x' where id = $1 returning id`, [item.id]);
  check('odebraný zaměstnanec zůstává čtenářem', (await as(staffA, 'select id from public.catalog_items')).length === 3);

  console.log('Osobní chaty');
  const cabin = await one(reader1, `insert into public.cabins (user_id, name) values ($1, 'Moje') returning *`, [reader1]);
  const ownBook = await one(reader1, `insert into public.cabin_books (cabin_id, user_id, title, data) values ($1, $2, 'Hobit', '{"genre":"Fantasy"}') returning *`, [cabin.id, reader1]);
  check('čtenář vidí svou chatu a knihu', (await as(reader1, 'select id from public.cabin_books')).length === 1);
  check('cizí čtenář nevidí chatu', (await as(reader2, 'select id from public.cabins')).length === 0);
  check('cizí čtenář nevidí knihy', (await as(reader2, 'select id from public.cabin_books')).length === 0);
  check('knihovník nevidí osobní knihy', (await as(staffA, 'select id from public.cabin_books')).length === 0);
  await denied('nejde založit chatu cizímu účtu', reader2, `insert into public.cabins (user_id, name) values ($1, 'x')`, [reader1], /row-level security/);
  await denied('nejde vložit knihu do cizí chaty', reader2, `insert into public.cabin_books (cabin_id, user_id, title) values ($1, $2, 'x')`, [cabin.id, reader2], /row-level security/);
  await denied('anon nevidí chaty', null, 'select * from public.cabins', [], /permission denied/);
  await noRows('cizí čtenář nezmění knihu', reader2, `update public.cabin_books set title = 'x' where id = $1 returning id`, [ownBook.id]);
  await noRows('cizí čtenář nesmaže knihu', reader2, `delete from public.cabin_books where id = $1 returning id`, [ownBook.id]);
  check('čtenář uloží nastavení', (await one(reader1, `update public.profiles set settings = '{"active_cabin":"x"}' where id = $1 returning settings`, [reader1])).settings.active_cabin === 'x');
  await as(reader1, 'delete from public.cabins where id = $1', [cabin.id]);
  check('smazání chaty smaže její knihy', (await db.query('select 1 from public.cabin_books where id = $1', [ownBook.id])).rows.length === 0);

  console.log('Správce aplikace');
  const owner = await createUser('Daniel');
  await db.query(`update auth.users set email = 'daniel@lunacek.cz', email_confirmed_at = now() where id = $1`, [owner]);
  await denied('čtenář není správce aplikace', reader1, 'select public.admin_list_users()', [], /Jen správce/);
  await denied('čtenář nesmaže knihovnu přes admin', reader1, 'select public.admin_delete_library($1)', [libB.id], /Jen správce/);
  await denied('čtenář nesmaže účet přes admin', reader1, 'select public.admin_delete_user($1)', [reader2], /Jen správce/);
  await denied('anon nespustí admin funkci', null, 'select public.admin_list_libraries()', [], /permission denied/);
  check('is_app_admin: správce', (await one(owner, 'select public.is_app_admin() as a')).a === true);
  check('is_app_admin: čtenář', (await one(reader1, 'select public.is_app_admin() as a')).a === false);
  check('správce vidí všechny účty', (await as(owner, 'select * from public.admin_list_users()')).length >= 7);
  check('správce vidí všechny knihovny', (await as(owner, 'select * from public.admin_list_libraries()')).length === 2);
  await denied('správce nesmaže sám sebe', owner, 'select public.admin_delete_user($1)', [owner], /Vlastní účet/);
  await as(owner, 'select public.admin_delete_user($1)', [reader2]);
  check('účet je smazán', (await db.query('select 1 from auth.users where id = $1', [reader2])).rows.length === 0);
  await as(owner, 'select public.admin_delete_library($1)', [libB.id]);
  check('knihovna je smazána', (await db.query('select 1 from public.libraries where id = $1', [libB.id])).rows.length === 0);

  await db.close();
  console.log(`\nProšlo: ${passed}, neprošlo: ${failures.length}`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error('Ověření spadlo:', err);
  process.exit(1);
});
