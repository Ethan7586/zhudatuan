import { describe, expect, it } from 'vitest';
import type { CartOffer } from '../model/CartLine';
import { CartPolicy } from './CartPolicy';

function offer(listing: string, sku: string, override: Partial<CartOffer> = {}): CartOffer {
  return Object.freeze({ listing, sku, title: listing, amountMinor: 100, currency: 'CNY', available: 20, benefitApplicable: true, listingVersion: '1', priceVersion: 'price:1', inventoryVersion: 'stock:1', code: 'valid', ...override });
}

describe('CartPolicy', () => {
  it('returns a result for every batch item while applying independent valid mutations', () => {
    const policy = new CartPolicy();
    const lines = [
      { listing: 'listing:a', sku: 'sku:a', quantity: 1, selected: true, version: 2 },
      { listing: 'listing:b', sku: 'sku:b', quantity: 2, selected: true, version: 1 },
    ];
    const changes = [
      { listing: 'listing:a', quantity: 2, selected: null, lineVersion: 1 },
      { listing: 'listing:b', quantity: 0, selected: null, lineVersion: 1 },
      { listing: 'listing:c', quantity: 1, selected: null, lineVersion: null },
      { listing: 'listing:d', quantity: 3, selected: false, lineVersion: null },
    ];
    const plan = policy.plan(
      lines,
      changes,
      new Map([
        ['listing:c', offer('listing:c', 'sku:c', { code: 'unpriced' })],
        ['listing:d', offer('listing:d', 'sku:d')],
      ])
    );
    expect(plan.results.map(({ outcome, reason }) => [outcome, reason])).toEqual([
      ['failed', 'versionconflict'],
      ['succeeded', null],
      ['failed', 'unpriced'],
      ['succeeded', null],
    ]);
    expect(plan.mutations).toEqual([expect.objectContaining({ listing: 'listing:b', quantity: 0, version: 1 }), expect.objectContaining({ listing: 'listing:d', quantity: 3, selected: false, version: null })]);
  });

  it('coalesces different listings for the same SKU into one atomic mutation', () => {
    const policy = new CartPolicy();
    const changes = [
      { listing: 'listing:a', quantity: 1, selected: true, lineVersion: null },
      { listing: 'listing:b', quantity: 2, selected: true, lineVersion: null },
    ];
    const plan = policy.plan(
      [],
      changes,
      new Map([
        ['listing:a', offer('listing:a', 'sku:one')],
        ['listing:b', offer('listing:b', 'sku:one')],
      ])
    );
    expect(plan.results).toHaveLength(2);
    expect(plan.mutations).toEqual([expect.objectContaining({ listing: 'listing:a', sku: 'sku:one', quantity: 3, version: null })]);
  });

  it('enforces configured line and quantity limits without failing unrelated items', () => {
    const policy = new CartPolicy(1, 5, 10);
    const plan = policy.plan(
      [{ listing: 'listing:a', sku: 'sku:a', quantity: 1, selected: true, version: 0 }],
      [
        { listing: 'listing:b', quantity: 1, selected: null, lineVersion: null },
        { listing: 'listing:a', quantity: 6, selected: null, lineVersion: 0 },
      ],
      new Map([
        ['listing:a', offer('listing:a', 'sku:a')],
        ['listing:b', offer('listing:b', 'sku:b')],
      ])
    );
    expect(plan.results.map(({ reason }) => reason)).toEqual(['linelimit', 'quantitylimit']);
  });

  it('merges anonymous and member lines by SKU and refuses lossy overflow', () => {
    const policy = new CartPolicy(2, 5, 10);
    const target = [{ listing: 'listing:member', sku: 'sku:one', quantity: 2, selected: false, version: 3 }];
    const source = [{ listing: 'listing:guest', sku: 'sku:one', quantity: 2, selected: true, version: 1 }];
    expect(policy.merge(target, source)).toEqual({ blocked: null, mutations: [expect.objectContaining({ listing: 'listing:member', quantity: 4, selected: true, version: 3 })] });
    expect(policy.merge(target, [{ ...source[0]!, quantity: 4 }])).toEqual({ blocked: 'quantitylimit', mutations: [] });
  });

  it('retains invalid lines with specific current validity and no frozen amount', () => {
    const policy = new CartPolicy();
    const line = { listing: 'listing:a', sku: 'sku:a', quantity: 3, selected: true, version: 1 };
    expect(policy.present(line, offer('listing:a', 'sku:a', { amountMinor: 250, available: 2 }))).toMatchObject({ amountMinor: 250, validity: { state: 'invalid', code: 'outofstock' } });
    expect(policy.present(line, undefined)).toMatchObject({ amountMinor: null, title: '已失效商品', validity: { code: 'unpublished' } });
  });
});
