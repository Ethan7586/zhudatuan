import { describe, expect, it } from 'vitest';
import { organizationScope } from './OrganizationScope';

describe('organizationScope', () => {
  it('keeps an organization scope unchanged', () => {
    expect(organizationScope({ kind: 'mall', id: 'mall-one', tenant: 'tenant-one', path: [] })).toBe('mall-one');
  });

  it('uses the nearest organization ancestor for a resource scope', () => {
    expect(
      organizationScope({
        kind: 'store',
        id: 'store-one',
        tenant: 'tenant-one',
        path: [
          { kind: 'platform', id: 'platform-one' },
          { kind: 'tenant', id: 'tenant-one' },
          { kind: 'enterprise', id: 'enterprise-one' },
          { kind: 'mall', id: 'mall-one' },
        ],
      })
    ).toBe('mall-one');
  });

  it('fails closed when a resource has no organization boundary', () => {
    expect(() => organizationScope({ kind: 'self', id: 'principal-one', path: [] })).toThrow('SCOPE_DENIED');
  });
});
