import { describe, expect, it } from 'vitest';
import { supportBoundary } from './SupportBoundary';

describe('supportBoundary', () => {
  it('places a storefront member conversation in the membership organization', () => {
    expect(
      supportBoundary({
        actor: { target: 'storefront' },
        organization: 'mall-one',
        scope: { kind: 'owner', id: 'member-one', path: [] },
      } as never)
    ).toBe('mall-one');
  });

  it('keeps the selected organization boundary for console operators', () => {
    expect(
      supportBoundary({
        actor: { target: 'console' },
        organization: 'mall-one',
        scope: { kind: 'department', id: 'department-one', tenant: 'tenant-one', path: [] },
      } as never)
    ).toBe('department-one');
  });
});
