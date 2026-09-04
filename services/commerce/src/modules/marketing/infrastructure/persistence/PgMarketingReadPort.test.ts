import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgMarketingReadPort } from './PgMarketingReadPort';

describe('PgMarketingReadPort', () => {
  it('previews effective promotions without reserving budget and returns immutable rule snapshots', async () => {
    const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
      expect(text.trimStart().startsWith('select')).toBe(true);
      expect(text).not.toMatch(/\b(?:insert|update|delete)\s/i);
      expect(values).toEqual(['mall:one']);
      return result([campaign()]);
    });
    const evaluated = await withReadTransaction(query, (context) =>
      new PgMarketingReadPort().evaluate(context, {
        scope: 'mall:one',
        member: 'member:one',
        channel: 'web',
        currency: 'CNY',
        subtotalMinor: 5_000,
        memberTags: ['new'],
        qualificationStates: ['approved'],
        productIds: ['product:one'],
        categoryIds: [],
        listingIds: [],
      })
    );
    expect(evaluated).toEqual({ amountMinor: 500, evidence: [{ id: 'campaign:one', version: 7, discount: 500 }] });
    expect(Object.isFrozen(evaluated)).toBe(true);
    expect(Object.isFrozen(evaluated.evidence)).toBe(true);
    expect(query).toHaveBeenCalledOnce();
  });

  it('resolves publication references from live campaign versions only', async () => {
    const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
      expect(text).toContain("state in('scheduled','active')");
      expect(values).toEqual([['campaign:one', 'campaign:two']]);
      return result([{ count: 2, version: 'campaign:one@7,campaign:two@3' }]);
    });
    const references = await withReadTransaction(query, (context) => new PgMarketingReadPort().references(context, ['campaign:two', 'campaign:one', 'campaign:two']));
    expect(references).toEqual({ ready: true, version: 'campaign:one@7,campaign:two@3' });
  });
});

function campaign() {
  return {
    id: 'campaign:one',
    scope_id: 'mall:one',
    kind: 'discount',
    name: '新客活动',
    state: 'active',
    budget_minor: 10_000,
    spent_minor: 1_000,
    budget_version: 4,
    currency: 'CNY',
    rule: {
      audience: { memberTags: ['new'], qualificationStates: ['approved'] },
      products: { productIds: ['product:one'], categoryIds: [], listingIds: [] },
      channels: ['web'],
      promotion: { priority: 1, fixedMinor: 500, basisPoints: 0, minimumSubtotal: 1_000, maximumMinor: 500, stackable: true, exclusiveGroup: 'welcome' },
      coupon: null,
    },
    effective_at: new Date('2026-09-01T00:00:00.000Z'),
    expires_at: new Date('2030-10-01T00:00:00.000Z'),
    version: 7,
    published_at: new Date('2026-09-01T00:00:00.000Z'),
    disabled_at: null,
    disable_reason: null,
    created_by: 'principal:maker',
    updated_by: 'principal:checker',
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_at: new Date('2026-09-01T00:00:00.000Z'),
  };
}
