import { describe, expect, it } from 'vitest';
import type { DomainPurchaseApproval, DomainPurchaseOwner, PurchasableDomainQuote } from '@shop/contract';
import { DomainPurchasePolicy, type DomainPurchaseIntent } from '../../02_domain_yewu/policy/DomainPurchasePolicy';

const policy = new DomainPurchasePolicy(['zhudatuan.com', 'fufuwang.com.cn']);
const owner: DomainPurchaseOwner = {
  organizationId: 'organization:mall-one',
  mallId: 'mall:one',
  resolvedLevel: 'L1',
};
const intent: DomainPurchaseIntent = {
  purchaseId: 'domain-purchase:one',
  owner,
  requestedDomain: 'Example-Shop.COM.',
  registrationYears: 2,
  maxAmountMinor: 20_000,
  currency: 'CNY',
  registrantContactRef: 'secret/domain-registrant/mall-one',
};
const quote: PurchasableDomainQuote = {
  providerId: 'aliyun-domain',
  quoteId: 'quote:one',
  domainAscii: 'example-shop.com',
  registrationYears: 2,
  availability: 'available',
  currency: 'CNY',
  totalMinor: 8_800,
  checkedAt: '2026-09-03T12:00:00.000Z',
  expiresAt: '2026-09-03T12:30:00.000Z',
};

function approval(overrides: Partial<DomainPurchaseApproval> = {}): DomainPurchaseApproval {
  return {
    approvalId: 'approval:one',
    purchaseId: intent.purchaseId,
    scopeId: owner.mallId,
    membershipId: 'membership:mall-owner',
    quoteFingerprint: policy.quoteFingerprint(intent, quote),
    amountMinor: quote.totalMinor,
    currency: quote.currency,
    fundingHoldRef: 'hold:domain-one',
    assuranceLevel: 2,
    approvedAt: '2026-09-03T12:05:00.000Z',
    ...overrides,
  };
}

describe('DomainPurchasePolicy', () => {
  it('builds one registrar quote request owned by the L0/L1 mall rather than an administrator', () => {
    expect(policy.quoteRequest(intent)).toEqual({
      purchaseId: 'domain-purchase:one',
      owner,
      domainAscii: 'example-shop.com',
      registrationYears: 2,
    });
    expect(policy.quoteRequest({ ...intent, owner: { ...owner, resolvedLevel: 'L0' } }).owner.resolvedLevel).toBe('L0');
  });

  it('binds purchase to one live quote, price ceiling, mall scope and encrypted registrant reference', () => {
    const command = policy.authorize(intent, quote, approval(), new Date('2026-09-03T12:10:00.000Z'));

    expect(command).toMatchObject({
      purchaseId: intent.purchaseId,
      owner,
      quote,
      registrantContactRef: 'secret/domain-registrant/mall-one',
      approval: { membershipId: 'membership:mall-owner', amountMinor: 8_800 },
    });
    expect(JSON.stringify(command)).not.toContain('phone');
    expect(JSON.stringify(command)).not.toContain('identityNumber');
  });

  it.each([
    ['https://example.com', 'DOMAIN_PURCHASE_NAME_INVALID'],
    ['*.example.com', 'DOMAIN_PURCHASE_NAME_INVALID'],
    ['api.zhudatuan.com', 'DOMAIN_PURCHASE_PLATFORM_ZONE_FORBIDDEN'],
    ['shop.fufuwang.com.cn', 'DOMAIN_PURCHASE_PLATFORM_ZONE_FORBIDDEN'],
  ])('rejects an unsafe purchase candidate %s', (requestedDomain, code) => {
    expect(() => policy.quoteRequest({ ...intent, requestedDomain })).toThrow(code);
  });

  it('accepts every operating-mall level and rejects consumer ownership and raw registrant data', () => {
    expect(policy.quoteRequest({
      ...intent,
      owner: { ...owner, resolvedLevel: 'L5' },
    }).owner.resolvedLevel).toBe('L5');
    expect(() => policy.quoteRequest({
      ...intent,
      owner: { ...owner, resolvedLevel: 'L6' as DomainPurchaseOwner['resolvedLevel'] },
    })).toThrow('DOMAIN_PURCHASE_LEVEL_NOT_ELIGIBLE');
    expect(() => policy.quoteRequest({ ...intent, registrantContactRef: 'Ethan 13800138000' }))
      .toThrow('DOMAIN_PURCHASE_REGISTRANT_REFERENCE_INVALID');
  });

  it('rejects expired, overpriced or differently approved quotes', () => {
    expect(() => policy.authorize(intent, quote, approval(), new Date('2026-09-03T12:31:00.000Z')))
      .toThrow('DOMAIN_PURCHASE_QUOTE_EXPIRED');
    expect(() => policy.authorize({ ...intent, maxAmountMinor: 8_000 }, quote, approval(), new Date('2026-09-03T12:10:00.000Z')))
      .toThrow('DOMAIN_PURCHASE_PRICE_LIMIT_EXCEEDED');
    expect(() => policy.authorize(intent, { ...quote, currency: 'USD' }, approval(), new Date('2026-09-03T12:10:00.000Z')))
      .toThrow('DOMAIN_PURCHASE_QUOTE_CURRENCY_MISMATCH');
    expect(() => policy.authorize(intent, quote, approval({ scopeId: 'mall:other' }), new Date('2026-09-03T12:10:00.000Z')))
      .toThrow('DOMAIN_PURCHASE_APPROVAL_MISMATCH');
    expect(() => policy.authorize(intent, quote, approval({ quoteFingerprint: 'wrong' }), new Date('2026-09-03T12:10:00.000Z')))
      .toThrow('DOMAIN_PURCHASE_APPROVAL_MISMATCH');
    expect(() => policy.authorize(intent, quote, approval({ assuranceLevel: 1 as 2 }), new Date('2026-09-03T12:10:00.000Z')))
      .toThrow('DOMAIN_PURCHASE_ASSURANCE_INVALID');
  });
});
