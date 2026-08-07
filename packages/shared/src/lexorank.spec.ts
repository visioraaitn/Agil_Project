import { describe, expect, it } from 'vitest';
import { INITIAL_RANK, initialRanks, rankAfter, rankBefore, rankBetween } from './lexorank';

describe('lexorank', () => {
  it('produit un rang initial non vide', () => {
    expect(INITIAL_RANK.length).toBeGreaterThan(0);
  });

  it('insère strictement entre deux bornes', () => {
    const a = 'a';
    const b = 'b';
    const mid = rankBetween(a, b);
    expect(mid > a).toBe(true);
    expect(mid < b).toBe(true);
  });

  it('gère les caractères adjacents sans collision', () => {
    let low = 'a';
    const high = 'b';
    for (let i = 0; i < 200; i += 1) {
      const mid = rankBetween(low, high);
      expect(mid > low).toBe(true);
      expect(mid < high).toBe(true);
      low = mid;
    }
  });

  it('place avant et après', () => {
    expect(rankBefore('b') < 'b').toBe(true);
    expect(rankAfter('b') > 'b').toBe(true);
  });

  it('génère une liste initiale strictement croissante', () => {
    const ranks = initialRanks(50);
    const sorted = [...ranks].sort();
    expect(ranks).toEqual(sorted);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('refuse des bornes incohérentes', () => {
    expect(() => rankBetween('b', 'a')).toThrow();
  });
});
