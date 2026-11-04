export const ACTIVE_LOAN_STATUSES = ['requested', 'approved', 'picked_up'];

export const LOAN_STATUS_LABELS = {
  requested: 'Čeká na schválení',
  approved: 'Schváleno, čeká na vyzvednutí',
  picked_up: 'Půjčeno',
  returned: 'Vráceno',
  rejected: 'Odmítnuto',
  cancelled: 'Zrušeno'
};

export const ITEM_STATUS_LABELS = {
  available: 'Dostupné',
  reserved: 'Rezervováno',
  on_loan: 'Půjčeno',
  unavailable: 'Vyřazeno'
};

export function isOverdue(loan, now = new Date()) {
  return loan.status === 'picked_up' && Boolean(loan.due_at) && new Date(loan.due_at) < now;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Výchozí termín vrácení pro pole typu date (YYYY-MM-DD v místním čase). */
export function defaultDueDate(now = new Date(), days = 30) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Vrátit jde do konce zvoleného dne v místním čase. */
export function dueDateToIso(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('cs-CZ') : '';
}

/** Může čtenář o výtisk požádat? Konečné rozhodnutí má vždy databáze. */
export function requestAvailability(item, library, myLoans = []) {
  const mine = myLoans.find((l) => l.catalog_item_id === item.id && ACTIVE_LOAN_STATUSES.includes(l.status));
  if (mine) return { canRequest: false, reason: `Tvoje žádost: ${LOAN_STATUS_LABELS[mine.status].toLowerCase()}.` };
  if (!library?.loans_enabled) return { canRequest: false, reason: 'Tato knihovna teď nepůjčuje.' };
  if (item.status !== 'available') {
    return { canRequest: false, reason: `Výtisk teď není dostupný (${ITEM_STATUS_LABELS[item.status].toLowerCase()}).` };
  }
  return { canRequest: true, reason: '' };
}
