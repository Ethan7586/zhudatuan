import { describe, expect, it } from 'vitest';
import { Money } from '@shop/kernel';
import { Offer } from './model/Offer';
import { PriceBook } from './model/PriceBook';
import { PricingRule } from './model/PricingRule';
import { Quote } from './model/Quote';
import { PricingEngine } from './service/PricingEngine';

const now = new Date('2026-09-05T00:00:00.000Z');

describe('Pricing domain', () => {
  it('models an active CNY price book and effective offer using integer minor units', () => {
    const book = PriceBook.create({ id: 'pricebook:one', scope: 'mall:one', currency: 'CNY', name: ' 商城价格簿 ' }).snapshot();
    const offer = Offer.create({ id: 'price:one', book: book.id, sku: 'sku:one', amountMinor: 10000, compareMinor: 12000, currency: book.currency, effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: null }).effective(now);
    expect(book).toMatchObject({ name: '商城价格簿', state: 'active', version: 1 });
    expect(offer.amount.minor).toBe(10000);
    expect(() => Offer.create({ id: 'price:bad', book: book.id, sku: 'sku:one', amountMinor: 100, compareMinor: 99, currency: 'CNY', effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: null })).toThrow();
    expect(() => PriceBook.create({ id: 'pricebook:bad', scope: 'mall:one', currency: 'USD' as never, name: '非法币种' })).toThrow('CURRENCY_UNSUPPORTED');
  });

  it('publishes a bounded rule only with the exact version and an approver', () => {
    const rule = draft('rule:one', 'markup', 1, { fixedMinor: 100 });
    expect(rule.publish(1, 'principal:checker', now).snapshot()).toMatchObject({ state: 'published', version: 2, approvedBy: 'principal:checker' });
    expect(() => rule.publish(2, 'principal:checker', now)).toThrow();
    expect(() => rule.publish(1, '', now)).toThrow();
  });

  it('applies cost markup discount tax and freight in one deterministic engine', () => {
    const rules = [
      draft('rule:markup', 'markup', 10, { basisPoints: 1000 }).publish(1, 'principal:checker', now),
      draft('rule:discount', 'discount', 20, { fixedMinor: 500 }).publish(1, 'principal:checker', now),
      draft('rule:tax', 'tax', 30, { basisPoints: 1000 }).publish(1, 'principal:checker', now),
      draft('rule:freight', 'freight', 40, { fixedMinor: 200 }).publish(1, 'principal:checker', now),
    ];
    const result = new PricingEngine().price(baseOffer(), rules, now);
    expect(result.amount.minor).toBe(11750);
    expect(result.breakdown.map(({ kind, amountMinor }) => [kind, amountMinor])).toEqual([
      ['base', 10000],
      ['markup', 1000],
      ['discount', -500],
      ['tax', 1050],
      ['freight', 200],
    ]);
    expect(result.breakdown.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(result.amount.minor);
  });

  it('selects one winner per exclusive group while retaining explicitly stackable rules', () => {
    const rules = [
      draft('rule:first', 'discount', 1, { fixedMinor: 100, exclusiveGroup: 'campaign' }).publish(1, 'principal:checker', now),
      draft('rule:second', 'discount', 2, { fixedMinor: 200, exclusiveGroup: 'campaign' }).publish(1, 'principal:checker', now),
      draft('rule:stack', 'discount', 3, { fixedMinor: 50, exclusiveGroup: 'campaign', stackable: true }).publish(1, 'principal:checker', now),
    ];
    const result = new PricingEngine().price(baseOffer(), rules, now);
    expect(result.rules.map(({ id }) => id)).toEqual(['rule:first', 'rule:stack']);
    expect(result.amount.minor).toBe(9850);
  });

  it('allocates rounding remainder deterministically without losing a minor unit', () => {
    const allocated = new PricingEngine().allocate(Money.of(1), [
      { key: 'sku:b', weight: Money.of(1) },
      { key: 'sku:a', weight: Money.of(1) },
      { key: 'sku:c', weight: Money.of(1) },
    ]);
    expect([...allocated].map(([key, value]) => [key, value.minor])).toEqual([
      ['sku:b', 0],
      ['sku:a', 1],
      ['sku:c', 0],
    ]);
  });

  it('keeps a signed quote immutable and rejects it after expiry without reinterpreting rules', () => {
    const quote = Quote.create({
      id: 'quote:one',
      member: 'member:one',
      mall: 'mall:one',
      currency: 'CNY',
      subtotalMinor: 1000,
      discountMinor: 100,
      payableMinor: 900,
      lines: [{ sku: 'sku:one', amountMinor: 900 }],
      evidenceHash: 'a'.repeat(64),
      dependencies: { pricing: [{ rule: 'rule:one', version: 2 }] },
      payload: { payableMinor: 900 },
      signature: 'b'.repeat(64),
      createdAt: '2026-09-05T00:00:00.000Z',
      expiresAt: '2026-09-05T00:15:00.000Z',
    });
    expect(quote.use('member:one', 'mall:one', new Date('2026-09-05T00:14:59.999Z')).payload).toEqual({ payableMinor: 900 });
    expect(() => quote.use('member:one', 'mall:one', new Date('2026-09-05T00:15:00.000Z'))).toThrow();
  });
});

function draft(id: string, kind: 'markup' | 'discount' | 'tax' | 'freight', priority: number, effect: Readonly<Record<string, unknown>>) {
  return PricingRule.draft({ id, scope: 'mall:one', priority, kind, condition: {}, effect, effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: '2026-10-01T00:00:00.000Z' });
}
function baseOffer() {
  return Offer.create({ id: 'price:one', book: 'pricebook:one', sku: 'sku:one', amountMinor: 10000, compareMinor: null, currency: 'CNY', effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: null });
}
