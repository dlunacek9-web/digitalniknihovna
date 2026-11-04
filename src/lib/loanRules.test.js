import { describe, expect, it } from 'vitest';
import { defaultDueDate, dueDateToIso, isOverdue, requestAvailability } from './loanRules.js';

const library = { loans_enabled: true };
const item = { id: 'a', status: 'available' };

describe('isOverdue', () => {
  const now = new Date('2026-11-04T12:00:00Z');

  it('platí jen pro předanou knihu po termínu', () => {
    expect(isOverdue({ status: 'picked_up', due_at: '2026-11-01T00:00:00Z' }, now)).toBe(true);
    expect(isOverdue({ status: 'picked_up', due_at: '2026-12-01T00:00:00Z' }, now)).toBe(false);
    expect(isOverdue({ status: 'returned', due_at: '2026-11-01T00:00:00Z' }, now)).toBe(false);
    expect(isOverdue({ status: 'approved', due_at: null }, now)).toBe(false);
  });
});

describe('termín vrácení', () => {
  it('výchozí termín je za 30 dní, i přes konec měsíce', () => {
    expect(defaultDueDate(new Date(2026, 0, 15))).toBe('2026-02-14');
  });

  it('výchozí termín lze zadat vlastní délkou', () => {
    expect(defaultDueDate(new Date(2026, 11, 31), 1)).toBe('2027-01-01');
  });

  it('platí do konce zvoleného dne v místním čase', () => {
    const due = new Date(dueDateToIso('2026-12-04'));
    expect([due.getFullYear(), due.getMonth(), due.getDate(), due.getHours()]).toEqual([2026, 11, 4, 23]);
  });
});

describe('requestAvailability', () => {
  it('povolí dostupný výtisk v knihovně, která půjčuje', () => {
    expect(requestAvailability(item, library).canRequest).toBe(true);
  });

  it('nepovolí, když knihovna nepůjčuje', () => {
    const result = requestAvailability(item, { loans_enabled: false });
    expect(result).toEqual({ canRequest: false, reason: 'Tato knihovna teď nepůjčuje.' });
  });

  it('nepovolí nedostupný výtisk', () => {
    expect(requestAvailability({ ...item, status: 'on_loan' }, library).canRequest).toBe(false);
    expect(requestAvailability({ ...item, status: 'reserved' }, library).canRequest).toBe(false);
  });

  it('upozorní na vlastní aktivní žádost', () => {
    const result = requestAvailability(item, library, [{ catalog_item_id: 'a', status: 'requested' }]);
    expect(result.canRequest).toBe(false);
    expect(result.reason).toContain('čeká na schválení');
  });

  it('starou vyřízenou žádost ignoruje', () => {
    const loans = [{ catalog_item_id: 'a', status: 'returned' }, { catalog_item_id: 'a', status: 'rejected' }];
    expect(requestAvailability(item, library, loans).canRequest).toBe(true);
  });
});
