const AUTH_MESSAGES = [
  [/invalid login credentials/i, 'Špatný email nebo heslo.'],
  [/user already registered|already been registered/i, 'Účet s tímto emailem už existuje.'],
  [/email not confirmed/i, 'Nejdřív potvrď email odkazem ze zprávy.'],
  [/password should be different|different from the old password/i, 'Nové heslo musí být jiné než to dosavadní.'],
  [/password should be|weak.?password/i, 'Heslo je příliš slabé. Použij aspoň 8 znaků.'],
  [/rate limit|too many requests/i, 'Příliš mnoho pokusů. Zkus to za chvíli.'],
  [/signups? (are |is )?(not allowed|disabled)/i, 'Registrace jsou vypnuté.'],
  [/invalid.*email|email.*invalid/i, 'Zadej platný email.']
];

const NETWORK = /failed to fetch|networkerror|load failed|network request failed/i;

/** Převede chybu Supabase na větu pro uživatele. Technický text se ven nedostane. */
export function toCzechMessage(error) {
  const message = String(error?.message || '');
  const code = String(error?.code || '');

  if (NETWORK.test(message)) return 'Nepodařilo se spojit se serverem. Zkontroluj připojení.';

  // Zprávy z našich funkcí v databázi jsou česky a určené uživateli.
  if (code === 'P0001') return message;
  if (code === '42501') {
    return /permission denied|row-level security/i.test(message)
      ? 'Na tuto akci nemáš oprávnění.'
      : message;
  }
  if (code === '23505') {
    if (/inventory_number/i.test(message)) return 'Toto inventární číslo už v knihovně je.';
    if (/cabin_books_one_per_loan/i.test(message)) return 'Tahle vypůjčená kniha už v chatě je.';
    return 'Takový záznam už existuje.';
  }
  if (code === '23503') return 'Záznam nejde smazat, protože se na něj odkazují jiná data.';
  if (code === '23514') return 'Zadané údaje nejsou platné.';

  for (const [pattern, text] of AUTH_MESSAGES) {
    if (pattern.test(message)) return text;
  }
  return 'Něco se nepovedlo. Zkus to prosím znovu.';
}

/** Rozbalí odpověď Supabase: vrátí data, nebo vyhodí chybu s českou zprávou. */
export function unwrap({ data, error }) {
  if (error) throw new Error(toCzechMessage(error));
  return data;
}
