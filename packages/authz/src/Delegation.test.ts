import { describe, expect, it } from 'vitest';
import { canDelegatePermissions } from './Delegation';

describe('canDelegatePermissions', () => {
  it('accepts only known delegatable permissions effectively allowed to the issuer', () => {
    const issuer = new Set(['access.role.delegate', 'access.scope.delegate', 'order.read']);
    expect(canDelegatePermissions(issuer, new Set(), ['access.role.delegate', 'order.read'])).toBe(true);
    expect(canDelegatePermissions(issuer, new Set(), ['unknown.permission'])).toBe(false);
    expect(canDelegatePermissions(issuer, new Set(['order.read']), ['order.read'])).toBe(false);
    expect(canDelegatePermissions(issuer, new Set(), ['access.ownership.transfer'])).toBe(false);
  });
});
