import { describe, expect, it } from 'vitest';
import { toCzechMessage, unwrap } from './errors.js';

describe('toCzechMessage', () => {
  it('předá českou zprávu z databázové funkce', () => {
    expect(toCzechMessage({ code: 'P0001', message: 'Výtisk není dostupný.' })).toBe('Výtisk není dostupný.');
    expect(toCzechMessage({ code: '42501', message: 'Výpůjčka nebyla nalezena.' })).toBe('Výpůjčka nebyla nalezena.');
  });

  it('nikdy neukáže technický text databáze', () => {
    expect(toCzechMessage({ code: '42501', message: 'permission denied for table loans' })).toBe('Na tuto akci nemáš oprávnění.');
    expect(toCzechMessage({ code: '42501', message: 'new row violates row-level security policy' })).toBe('Na tuto akci nemáš oprávnění.');
    expect(toCzechMessage({ code: '08000', message: 'connection to server lost at 10.0.0.1' })).toBe('Něco se nepovedlo. Zkus to prosím znovu.');
    expect(toCzechMessage(undefined)).toBe('Něco se nepovedlo. Zkus to prosím znovu.');
  });

  it('přeloží chyby přihlášení a sítě', () => {
    expect(toCzechMessage({ message: 'Invalid login credentials' })).toBe('Špatný email nebo heslo.');
    expect(toCzechMessage({ message: 'User already registered' })).toBe('Účet s tímto emailem už existuje.');
    expect(toCzechMessage({ message: 'TypeError: Failed to fetch' })).toContain('spojit se serverem');
  });

  it('přeloží porušení omezení', () => {
    expect(
      toCzechMessage({ code: '23505', message: 'duplicate key value violates unique constraint "catalog_items_inventory_number_key"' })
    ).toContain('inventární číslo');
    expect(
      toCzechMessage({ code: '23505', message: 'duplicate key value violates unique constraint "cabin_books_one_per_loan"' })
    ).toContain('vypůjčená kniha');
    expect(toCzechMessage({ code: '23505', message: 'duplicate key' })).toBe('Takový záznam už existuje.');
  });
});

describe('unwrap', () => {
  it('vrátí data, nebo vyhodí českou chybu', () => {
    expect(unwrap({ data: [1], error: null })).toEqual([1]);
    expect(() => unwrap({ data: null, error: { code: 'P0001', message: 'Chyba.' } })).toThrow('Chyba.');
  });
});
