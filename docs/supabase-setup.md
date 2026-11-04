# Nastavení Supabase

Postup založí databázi, přihlašování a lokální konfiguraci aplikace. Názvy položek v dashboardu Supabase se mohou časem mírně změnit.

## 1. Založení projektu

1. Zaregistruj se na [supabase.com](https://supabase.com) a klikni na **New project**.
2. Zvol název (například `digitalniknihovna`) a region blízko uživatelům (například Frankfurt).
3. Vygeneruj heslo databáze a ulož ho do správce hesel. Aplikace ho nepotřebuje a do repozitáře nepatří.
4. Počkej, až se projekt vytvoří.

## 2. Spuštění migrací

Vyber jen jeden způsob. Ruční spuštění se nezapíše do historie integrace, takže kombinace obou skončí chybou `already exists`.

### Přes propojení s GitHubem (tento projekt)

V **Project Settings → Integrations → GitHub** je zapnuté **Deploy to production**, **Working directory** je `.` a **Production branch name** je nasazovaná větev. Migrace se spustí samy po pushi na tuto větev. Nové změny databáze proto vždy patří do nového souboru v `supabase/migrations/`, stávající soubory se neupravují.

### Ručně přes SQL Editor (projekt bez propojení)

Spusť soubory ze složky `supabase/migrations/` přesně v tomto pořadí. Každý soubor spusť jen jednou.

1. V levém menu otevři **SQL Editor** a klikni na **New query**.
2. Vlož celý obsah `20261104000100_schema.sql` a klikni na **Run**.
3. Stejně spusť `20261104000200_rls.sql`.
4. Stejně spusť `20261104000300_rpc.sql`.
5. Stejně spusť `20261104000400_loan_cabin_and_return.sql`.
6. Stejně spusť další soubory ve složce v pořadí podle názvu.

Pokud některý soubor skončí chybou, nepokračuj dalším a pošli mi text chyby.

## 3. Kontrola databáze

V SQL Editoru spusť tento dotaz:

```sql
select
  (select count(*) from pg_tables
    where schemaname = 'public' and rowsecurity) as tabulek_s_rls,
  (select count(*) from pg_tables
    where schemaname = 'public' and not rowsecurity) as tabulek_bez_rls,
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon') as grantu_pro_anon,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')) as funkci_pro_anon;
```

Správný výsledek je `6, 0, 0, 0`. Jiný výsledek znamená, že aplikaci zatím nemáš používat.

## 4. Přihlašování

V **Authentication → Sign In / Providers**:

1. Nech zapnutý **Email** a povolené nové registrace.
2. **Anonymous sign-ins nech vypnuté.** Anonymní přihlášení dostává roli `authenticated`, takže by otevřelo katalog bez účtu.
3. Rozhodni o **Confirm email**:
   - Vypnuto: žák se přihlásí hned. Registrovat se ale může i neexistující adresa. Pro školní projekt je to nejjednodušší volba.
   - Zapnuto: adresa se ověří, ale vestavěné odesílání má nízký limit, takže hromadná registrace třídy může narazit. Pro větší objem by bylo potřeba vlastní SMTP.

### Přihlášení přes Google

1. V [Google Cloud Console](https://console.cloud.google.com) otevři **APIs & Services → Credentials → Create credentials → OAuth client ID** (typ **Web application**). Případně nejdřív nastav **OAuth consent screen**.
2. Do **Authorized redirect URIs** vlož **Callback URL**, který ukazuje Supabase v **Authentication → Sign In / Providers → Google** (tvar `https://<projekt>.supabase.co/auth/v1/callback`).
3. Zkopíruj **Client ID** a **Client secret** do téhož okna v Supabase, zapni **Enable Sign in with Google** a ulož. Client secret patří jen do Supabase, nikdy do aplikace ani repozitáře.
4. Každá aplikace vyžaduje účet, takže registrace přes Google funguje stejně jako registrace emailem.

V **Authentication → URL Configuration**:

1. **Site URL** nastav na adresu aplikace na GitHub Pages, tedy `https://<účet>.github.io/digitalniknihovna/`.
2. Do **Redirect URLs** přidej i `http://localhost:3000/digitalniknihovna/` pro lokální vývoj.

Na stejné adresy se vrací i odkaz z **Zapomenuté heslo**. Odkaz funguje jen v prohlížeči, ve kterém si ho uživatel vyžádal (PKCE). Email posílá Supabase, takže pro něj platí stejný limit vestavěného odesílání jako pro potvrzení registrace.

## 5. Klíče a lokální konfigurace

1. Otevři **Settings → API Keys**.
2. Zkopíruj **Publishable key** (začíná `sb_publishable_`).
3. Adresu projektu najdeš v **Settings → Data API** nebo ve **Connect** v horní liště.
4. V kořeni repozitáře zkopíruj `.env.example` na `.env.local` a doplň:

```
VITE_SUPABASE_URL=https://TVUJ-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Proměnná se jmenuje `ANON_KEY` podle zadání, ale patří do ní publishable key. Supabase starší `anon` a `service_role` klíče ukončuje koncem roku 2026. Pokud projekt nabídne jen starší `anon` key, dočasně poslouží také.

**Secret key ani `service_role` key nikdy nedávej do aplikace, do `.env.local`, do proměnných `VITE_*` ani do repozitáře.** Tyto klíče obcházejí RLS, a kdo je získá, má celou databázi. Vše s prefixem `VITE_` se dostane do veřejně staženého JavaScriptu.

Publishable key veřejný být smí, protože data chrání RLS a granty z migrací.

## 6. Klíče pro nasazený web

GitHub Pages sestavuje web na serverech GitHubu, kde `.env.local` není. Hodnoty proto patří do tajných proměnných repozitáře:

1. Na GitHubu otevři repozitář a jdi do **Settings → Secrets and variables → Actions**.
2. Klikni na **New repository secret** a přidej `VITE_SUPABASE_URL` se stejnou hodnotou jako v `.env.local`.
3. Stejně přidej `VITE_SUPABASE_ANON_KEY` s publishable key.

Bez nich se web sestaví dál, ale zůstane jen domácí chata bez přihlášení a knihoven.

## 7. První uživatel

1. Učitel se zaregistruje a přihlásí.
2. Zvolí **Založit školní knihovnu** a stane se jejím správcem.
3. V nastavení zapne půjčování. Nová knihovna má půjčování vypnuté, aby žáci nežádali o knihy, než bude katalog hotový.
4. Další zaměstnance přidá pozvánkovým kódem.

Rychlá kontrola triggeru: po první registraci musí být nový řádek v **Table Editor → profiles**.

## Ověření oprávnění

```bash
npm run verify:rls
```

Skript spustí migrace na lokálním Postgresu (PGlite) s napodobenými rolemi Supabase. Nepřipojuje se k tvému projektu, takže skutečný projekt ověřuje jen kontrola v kroku 3.

## Mazání účtů

Čtenář si účet smaže sám na stránce Účet. Funkce `delete_my_account` uvolní jeho aktivně půjčené výtisky, smaže historii jeho výpůjček a pak účet. Jediný správce knihovny účet smazat nemůže, nejdřív musí jmenovat dalšího správce. Migrace `20261104000500_delete_account.sql` se musí spustit i na živém projektu.
