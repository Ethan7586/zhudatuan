import { describe, expect, it, vi } from 'vitest';
import type { OrganizationReadPort } from '../../../organization/public';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { CatalogScopeReader } from './CatalogScopeReader';

describe('CatalogScopeReader', () => {
  it('separates visible mall scopes through the organization read port', async () => {
    const organizations = {
      scope: vi.fn(async () => ({ id: 'store:one', scopeKind: 'store', timezone: 'Asia/Shanghai', tenant: 'tenant:one', ancestors: ['mall:one', 'enterprise:one'], descendants: ['store:one'] })),
      summaries: vi.fn(async (_context, ids: readonly string[]) => ids.map((id) => ({ id, name: id, kind: id.startsWith('mall:') ? 'mall' : id.startsWith('store:') ? 'store' : 'enterprise' }))),
    } as unknown as OrganizationReadPort;

    const scopes = await withReadTransaction(
      vi.fn(async () => result([])),
      (context) => new CatalogScopeReader(organizations).listings(context, 'store:one', true)
    );

    expect(scopes).toEqual({ visible: ['store:one', 'mall:one', 'enterprise:one'], malls: ['mall:one'] });
    expect(organizations.summaries).toHaveBeenCalledOnce();
  });
});
