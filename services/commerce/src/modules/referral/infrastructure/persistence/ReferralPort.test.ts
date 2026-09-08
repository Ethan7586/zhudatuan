import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgReferralReadPort } from './PgReferralReadPort';
import { PgReferralWritePort } from './PgReferralWritePort';

describe('Referral public ports', () => {
  it('fails closed across scope and returns only the storefront-safe attribution summary', async () => {
    const query = vi.fn(async (_text: string, _parameters?: readonly unknown[]) => ({ rows: [{ promoter_id: 'referralmember:one', source: 'storefront', expires_at: '2026-09-30T00:00:00.000Z', version: 2 }] }));
    const port = new PgReferralReadPort({ database: () => ({ query }) } as never);
    await expect(port.binding(context('mall:two') as ReadTransactionContext, 'mall:one', 'member:one')).rejects.toThrow('SCOPE_DENIED');
    await expect(port.binding(context('mall:one') as ReadTransactionContext, 'mall:one', 'member:one')).resolves.toEqual({ promoterId: 'referralmember:one', source: 'storefront', expiresAt: '2026-09-30T00:00:00.000Z', version: 2 });
    expect(query.mock.calls[0]?.[0]).toContain("state='active'");
  });

  it('creates only a scope-bound self attribution and never exposes an admin mutation', async () => {
    const save = vi.fn(async () => ({ id: 'referralbinding:one', version: 1 }));
    const port = new PgReferralWritePort({
      setting: async () => ({ enabled: true, bindingMode: 'days', firstTouchDays: 29 }),
      attribution: async () => ({ promoterMemberId: 'member:promoter', ancestors: ['member:promoter'] }),
      binding: async () => null,
      bind: save,
    } as never);
    const input = {
      id: 'referralbinding:one',
      scopeId: 'mall:one',
      customerId: 'member:customer',
      promoterId: 'referralmember:one',
      fingerprint: 'a'.repeat(64),
      source: 'storefront' as const,
      boundAt: '2026-09-01T00:00:00.000Z',
      expiresAt: '2026-09-30T00:00:00.000Z',
    };
    await expect(port.bind(context('mall:two') as WriteTransactionContext, input)).rejects.toThrow('SCOPE_DENIED');
    await expect(port.bind(context('mall:one') as WriteTransactionContext, input)).resolves.toEqual({ id: 'referralbinding:one', version: 1 });
    expect(save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scopeId: 'mall:one', customerId: 'member:customer', promoterMemberId: 'member:promoter' }));
  });
});

function context(scope: string) {
  return { scope, membership: 'membership:self', mode: 'write' } as unknown;
}
