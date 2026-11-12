# Generálka: audit před soutěží

Datum: 2026-11-12, branch `audit-generalka`.

Rozsah: celý kód (SQL migrace, RLS, RPC, React, služby), testy, build a `npm audit`.
Přihlašovací obrazovka byla ověřená v prohlížeči.
Části za přihlášením (3D chata, knihovnická část) jsem kontroloval jen v kódu, vizuálně ne.

Stav: 126/126 testů projde, build projde, `npm audit` hlásí 0 zranitelností, konzole je bez chyb.
Bezpečnost databáze je nadprůměrná: RLS na všech tabulkách, granty po sloupcích, RPC `security definer` se `search_path = ''`, zámky proti souběhu, stejné chyby pro cizí i neexistující záznamy.

Priorita: **P1** = uvidí ho učitel nebo je to skutečná chyba, **P2** = znatelné, **P3** = vyleštění.

---

## A. Uživatelské (UX) – tady je ta „nepřehlednost“

### P1
- [x] **A1. Tři názvy aplikace.** „Lukutupa“ je v hlavičce a v `<title>` ([App.jsx:468](../src/App.jsx), [index.html:6](../index.html)). „Moje Knihovna“ je v patičce profilu ([ProfileView.jsx:137](../src/components/ProfileView.jsx)). „Digitální knihovna“ je v chybě zálohy ([libraryBackup.js:56](../src/services/libraryBackup.js)). Vyber jeden název a použij ho všude.
- [x] **A2. Chaos v pojmech „chata“ a „knihovna“.** Pro jednu věc se střídají oba pojmy: panel „Moje knihovny“ má tlačítko „Postavit chatu“, toast píše „Knihovna smazána“ i „Nová chata“, výchozí chata se jmenuje „Knihovna 1“. Slovo „Knihovny“ přitom znamená i skutečné školní knihovny s výpůjčkami. Návrh: *chata* = moje sbírka, *knihovna* = jen instituce, která půjčuje.
- [x] **A3. Tlačítko „Městská knihovna“ v chatě** ([LibraryCabin.jsx:92](../src/components/LibraryCabin.jsx)) není knihovna. Je to hledání v celosvětové databázi Open Library. Vedle něj je záložka „Knihovny“ se skutečnými knihovnami. Uživatel si je splete. Přejmenuj ho, např. na „Hledat knihy ve světě“ nebo „Katalog knih“.
- [x] **A4. Profil vypadá nedodělaně** ([ProfileView.jsx:103-138](../src/components/ProfileView.jsx)):
  - Sekce „Připravované funkce“ hlásí „Stav čtení & Wishlist – Právě v vývoji“, ale tlačítka Chci číst / Čtu / Přečteno už v detailu knihy fungují. Je tam i překlep „v vývoji“.
  - „AI doporučování – Plánováno“ působí jako slib, ne jako hotová věc.
  - Patička tvrdí „Mobilní PWA“, ale aplikace nemá manifest ani service worker.
  - Celou sekci smaž a patičku oprav.
- [x] **A5. První dojem je holý login.** Na `/#/prihlaseni` není název aplikace ani věta o tom, co umí. Bez registrace nejde nic vidět. Pro učitele přidej nahoru název, 2–3 věty a obrázek chaty. Ideálně i tlačítko „Vyzkoušet bez účtu“, které otevře ukázkovou chatu (ta už existuje v paměti, viz `buildDemoLibrary`).
- [x] **A6. Chyba v ukázkových datech** ([demoLibrary.js:82](../src/services/demoLibrary.js)): „Hrdý Budžes“ nenapsal Josef Škvorecký (1969), ale Irena Dousková (1998). Učitel češtiny si toho všimne. Projdi i zbytek českého seznamu.

### P2
- [x] **A7. Knihu bez ISBN nejde přidat.** Ruční formulář se otevře jen po neúspěšném hledání ISBN a pole ISBN ve skeneru vyžaduje 10 nebo 13 číslic. Starší knihy bez čárového kódu tak přidat nejde. Přidej tlačítko „Přidat ručně“.
- [x] **A8. Údaje knihy nejdou po uložení opravit.** Detail umí jen změnit poličku, stav a půjčení. Překlep v názvu nebo autorovi se opraví jen smazáním a novým skenem. Přidej „Upravit“.
- [x] **A9. Dva různé „profily“.** Tlačítko Profil ve 3D chatě otevře plakát se statistikami, zálohou a půjčkami. Odkaz „Účet“ vede na jinou stránku se jménem, heslem, knihovnou a smazáním účtu. Sjednoť je, nebo je pojmenuj podle obsahu („Statistiky“ a „Účet“).
- [ ] **A10. Tři vizuální styly.** Prvním je 3D chata (tmavé dřevo). Druhým jsou bílé Tailwind karty: skener, ruční zadání, profil. Třetím je strohé „plain“ UI: přihlášení, účet, knihovnická část. Skener a ruční formulář vypadají jako jiná aplikace. Aspoň tyto dva převeď do stylu chaty (`book-detail`, `dock-btn`, `GenreField`).
- [x] **A11. Tykání a vykání se střídají.** Vyká se ve skeneru („Zadejte číslo ISBN“, [BookScanner.jsx:44](../src/components/BookScanner.jsx)), v ručním formuláři („Vyplňte“, „Můžete“) a v chybách z databáze („Nejste přihlášeni“, „Už patříte do knihovny“, „V této knihovně už jste zaměstnancem“). Zbytek aplikace tyká.
- [x] **A12. Účet každému čtenáři hned nabízí „Založit školní knihovnu“** ([AccountPage.jsx:27](../src/pages/AccountPage.jsx)). Čtenář tak může omylem založit knihovnu a stát se jejím správcem, protože jiný účet už knihovnu založit nemůže. Schovej formulář za „Jsem knihovník / správce“.
- [x] **A13. Skener má dvě zavírací tlačítka** (X vpravo nahoře a „Zpět do knihovny“). Výběr cílové chaty ve skeneru navíc potichu přepne i aktivní chatu.
- [x] **A14. Hledání najde jen knihy z aktuální chaty.** Text „V chatě nic takového není“ to aspoň přizná. Funkce `openBookAnywhere` už ale umí otevřít knihu z jiné chaty, takže stačí hledat ve všech chatách a u výsledku ukázat její jméno.

### P3
- [x] **A15. Špatné tvary čísel:** „Importováno 1 knih“ ([ProfileView.jsx:32](../src/components/ProfileView.jsx)), „1 čekajících žádostí“, „1 výtisků v katalogu“ ([Overview.jsx:36-38](../src/staff/Overview.jsx)). Použij `plural()`.
- [ ] **A16. Městská knihovna ukazuje doporučené knihy v anglických vydáních** (Harry Potter and the Philosopher's Stone…), přestože aplikace je česká.
- [x] **A17. Katalog knihovníka má na řádku 5–6 tlačítek** (Upravit, Další výtisk, Jiné vydání, Vyřadit, Smazat). Na mobilu je to přeplněné. Méně častá tlačítka dej do menu „⋯“.
- [x] **A18. Ruční formulář:** zavírací X nemá `aria-label`, nezavírá se klávesou Esc, žánr je obyčejné pole místo `GenreField` s nabídkou existujících poliček a chybí výběr cílové chaty.

---

## B. Technické

### P1
- [x] **B1. Osiřelé vypůjčené knihy.** Když správce aplikace smaže knihovnu (`admin_delete_library` smaže i její výpůjčky), zůstanou čtenářům v chatách knihy s `library_loan`. `reconcileBorrowedBooks` nechá knihu, k jejíž výpůjčce chybí záznam ([borrowedBooks.js:51](../src/lib/borrowedBooks.js)), protože ji považuje za knihu jiného účtu. Tlačítko Smazat je u vypůjčených knih skryté ([BookDetail.jsx:181](../src/components/BookDetail.jsx)). Kniha tak v chatě zůstane navždy jako „vypůjčeno“. Úložiště je u účtu, takže výjimka „jiný účet v tomto prohlížeči“ už neplatí. Výpůjčky z chaty, které server nevrátí, odeber.
- [x] **B2. Zavádějící chyba 23505.** Každé porušení unikátnosti hlásí „Toto inventární číslo už v knihovně je.“ ([errors.js:28](../src/lib/errors.js)). Stejnou chybu ale vyhodí i `cabin_books_one_per_loan` (souběh dvou zařízení nebo import zálohy). Uživatel chaty pak čte nesmysl o inventárním čísle. Rozliš chyby podle `error.message` nebo názvu constraintu.
- [x] **B3. Import zálohy importuje i vypůjčené knihy** ([libraryStore.js:470](../src/services/libraryStore.js)). Kniha s `library_loan` se vloží podruhé, narazí na unikátní index a celá dávka 200 knih spadne s hláškou z B2. Knihy s `library_loan` při importu přeskoč, synchronizace je stejně doplní.
- [x] **B4. Ve skeneru jde vybrat ukázková chata.** Komponenta `BookScanner` dostává nefiltrovaný seznam `libraries` ([App.jsx:529](../src/App.jsx)). Když uživatel vybere „Ukázka (tutoriál)“, `addBook` knihu potichu uloží do první vlastní chaty. Nový uživatel přitom začíná právě v ukázkové chatě. Předávej `libraries.filter((l) => !l.demo)`, stejně jako u `BookPreviewModal`.
- [x] **B5. Změny v ukázkové chatě po obnovení stránky zmizí.** Stav čtení, půjčení i smazání knihy se drží jen v paměti a nikde to není napsané. Uživatel si myslí, že aplikace ztrácí data. Akce v ukázce zablokuj, nebo ukaž upozornění „Ukázka se neukládá“.

### P2
- [x] **B6. Nejde přiblížit stránku.** `maximum-scale=1.0, user-scalable=no` ([index.html:5](../index.html)) porušuje přístupnost (WCAG 1.4.4). Slabozraký uživatel si text nezvětší. Pokud jde o zabránění zoomu při psaní na iOS, stačí písmo v polích aspoň 16 px.
- [x] **B7. Čtenář může požádat o neomezený počet výtisků.** Jeden žák tak může zarezervovat celý katalog. Přidej do `request_loan` limit, např. 5 aktivních žádostí a výpůjček na čtenáře.
- [x] **B8. Chybí favicon a manifest.** Neexistuje složka `public/`, takže `/favicon.ico` vrací 404 a záložka má obecnou ikonu. Na mobilu nejde aplikaci „Přidat na plochu“ s ikonou.
- [ ] **B9. Čtenář se o schválení dozví jen tehdy, když otevře aplikaci**, protože synchronizace běží při otevření a při návratu do okna. Knihovník zase nemá na čtenáře kontakt (email schválně nevidí), takže mu nemůže připomenout termín. Pro soutěž stačí na tohle omezení pamatovat při prezentaci.

### P3
- [ ] **B10. Hlavní balík má 517 kB (157 kB gzip).** Supabase a React se načítají hned na přihlašovací stránce. Pro školní Wi-Fi je to v pořádku, jen to není ideální.
- [x] **B11. Zaměstnanec, který není správce, nemůže sám opustit knihovnu**, protože `remove_staff` smí volat jen správce.
- [x] **B12. `admin_delete_user` může nechat knihovnu bez správce.** Je to zdokumentované, ale smazáním jediného správce vznikne knihovna, kterou už nikdo nespravuje.
- [x] **B13. URL obálky v ručním formuláři přijme i `http://`** a jakoukoli adresu. Prohlížeč pak hlásí mixed content a adresa může sloužit ke sledování. Katalog knihovny má na sloupci kontrolu `^https://`, chata ne.
- [ ] **B14. Email správce aplikace je napevno v migraci** (`20261104000600_app_admin.sql`). Pokud je repozitář veřejný, je ten email veřejný.

---

## Co je dobře (hodí se zmínit při prezentaci)
- Oprávnění hlídá databáze (RLS + RPC), ne frontend, takže obejít je přes konzoli prohlížeče nejde.
- Životní cyklus výpůjčky (žádost → schválení → předání → vrácení) má v databázi zámky proti souběhu dvou knihovníků.
- Pozvánkové kódy jsou jednorázové, náhodné a mají platnost.
- Knihovník má hromadné skenování, import a export CSV pro Excel a hlídání duplicit a vydání.
- Testy pokrývají logiku, k tomu je skript `verify:rls`.
- CSV export je ošetřený proti vzorcům (CSV injection).

---

## Stav oprav (2026-11-12)

Opravené body jsou zaškrtnuté. Testy 126/126, `verify:rls` 294/294, build prochází.

**Nutný krok navíc:** nová migrace `supabase/migrations/20261112000100_audit_fixes.sql` se musí spustit v Supabase (SQL Editor), jinak nebude fungovat odchod z knihovny, limit 5 žádostí ani tykání v chybách z databáze.

Co se oproti auditu přidalo:
- Ukázka bez účtu na `/#/ukazka`, odkaz na ni je na přihlašovací stránce.
- Přihlašovací stránka má úvod s názvem a třemi větami o aplikaci.
- Vlastní ikona (`public/favicon.svg`) a manifest pro přidání na plochu.

Nezaškrtnuté body:
- **A10:** ruční přidání knihy má styl chaty. Skener a profil zůstávají kartami, ale mají barvy chaty. Úplné sjednocení by byla větší přestavba.
- **A16:** doporučené knihy zůstaly v angličtině, protože obálky z Open Library existují jen pro tato vydání. Seznam je teď nadepsaný „světová klasika v původních vydáních“.
- **B9:** e-mailová upozornění by potřebovala serverovou funkci. Je to známé omezení.
- **B10:** Supabase a React jsou potřeba už na přihlašovací stránce, takže rozdělení balíku by první načtení nezrychlilo.
- **B14:** email správce v migraci zůstal. Pokud je repozitář veřejný, dá se později přesunout do tabulky správců.
