import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { PgNavigationOrganization } from './PgNavigationOrganization';

describe('PgNavigationOrganization', () => {
  it('projects only the four Console scope kinds from a mixed organization hierarchy', async () => {
    const rows = [
      row('platform:root', 'platform', true),
      row('distributor:east', 'distributor'),
      row('tenant:internal', 'tenant'),
      row('enterprise:one', 'enterprise'),
      row('mall:one', 'mall'),
      row('store:one', 'store'),
      row('supplier:one', 'supplier'),
    ];
    const database = { query: vi.fn(async () => ({ rows })) } as unknown as DatabasePool;

    const scopes = await new PgNavigationOrganization().read(database, ['membership:one']);

    expect(scopes.map((scope) => scope.kind)).toEqual(['platform', 'distributor', 'enterprise', 'mall']);
    expect(scopes.find((scope) => scope.default)?.id).toBe('platform:root');
    expect(scopes.every((scope) => scope.version === 7)).toBe(true);
  });
});

function row(scope: string, kind: string, isDefault = false) {
  return { membership_id: 'membership:one', scope_id: scope, scope_kind: kind, scope_status: 'active', scope_version: '7', is_default: isDefault };
}
