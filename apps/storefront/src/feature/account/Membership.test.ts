import { describe, expect, it } from 'vitest';
import { mapMemberships } from './infrastructure/AccountMapper';

describe('membership mapping', () => {
  it('keeps the server-selected membership and access version authoritative', () => {
    const memberships = mapMemberships({
      items: [
        { id: 'membership:one', organizationId: 'mall:one', name: '一号商城', current: true, accessVersion: 8 },
        { id: 'membership:two', organizationId: 'mall:two', name: '二号商城', current: false, accessVersion: 3 },
      ],
    } as never);
    expect(memberships.find(({ current }) => current)).toMatchObject({ id: 'membership:one', organizationId: 'mall:one', accessVersion: 8 });
    expect(Object.isFrozen(memberships)).toBe(true);
  });
});
