import { describe, expect, it, vi } from 'vitest';

import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { MembershipDestination } from './MembershipDestination';

const context = { mode: 'read' } as ReadTransactionContext;

describe('MembershipDestination', () => {
  it('binds a root storefront target to the active mall owned by the selected membership', async () => {
    const issue = vi.fn(() => signed('http://127.0.0.1:3000/s/zhudatuan-local', 'resolved-proof'));
    const storefront = vi.fn(async () => ({ handle: 'zhudatuan-local' }));
    const destination = new MembershipDestination({ verify: vi.fn(() => signed('http://127.0.0.1:3000', 'root-proof')), issue } as never, { storefront } as never);

    const resolved = await destination.resolve(context, { target: 'storefront', returnTarget: 'root-proof', organization: 'mall:zhudatuan' });

    expect(resolved).toMatchObject({ url: 'http://127.0.0.1:3000/s/zhudatuan-local', proof: 'resolved-proof' });
    expect(storefront).toHaveBeenCalledWith(context, 'mall:zhudatuan');
    expect(issue).toHaveBeenCalledWith('storefront', { path: '/s/zhudatuan-local' });
  });

  it('preserves an explicit signed storefront deep link without resolving another mall', async () => {
    const storefront = vi.fn();
    const supplied = signed('http://127.0.0.1:3000/s/zhudatuan-local/orders', 'deep-link-proof');
    const destination = new MembershipDestination({ verify: vi.fn(() => supplied), issue: vi.fn() } as never, { storefront } as never);

    await expect(destination.resolve(context, { target: 'storefront', returnTarget: supplied.proof, organization: 'mall:zhudatuan' })).resolves.toBe(supplied);
    expect(storefront).not.toHaveBeenCalled();
  });

  it('rejects a root storefront target when the selected membership has no active mall', async () => {
    const destination = new MembershipDestination({ verify: vi.fn(() => signed('http://127.0.0.1:3000', 'root-proof')), issue: vi.fn() } as never, { storefront: vi.fn(async () => null) } as never);

    await expect(destination.resolve(context, { target: 'storefront', returnTarget: 'root-proof', organization: 'disabled:mall' })).rejects.toMatchObject({ code: 'MEMBERSHIP_INACTIVE' });
  });
});

function signed(url: string, proof: string) {
  return Object.freeze({ url, proof, expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' as const });
}
