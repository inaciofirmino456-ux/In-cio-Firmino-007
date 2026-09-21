import { describe, expect, it } from 'vitest';
import { claimPrice, rebidChargeCents, sortRanking } from '../src/lib/ranking';

describe('ranking', () => {
  it('orders by amount and keeps older item first on ties', () => {
    const result = sortRanking([
      { id:'new', totalPaidCents:1000, createdAt:20 },
      { id:'old', totalPaidCents:1000, createdAt:10 },
      { id:'top', totalPaidCents:1500, createdAt:30 },
    ]);
    expect(result.map(x=>x.id)).toEqual(['top','old','new']);
  });
  it('calculates the #1 claim price', () => {
    expect(claimPrice(10000)).toBe(10500);
    expect(claimPrice(0)).toBe(100);
  });
  it('charges only the rebid difference', () => {
    expect(rebidChargeCents(1000,1100)).toBe(100);
    expect(()=>rebidChargeCents(1000,1050)).toThrow();
  });
});
