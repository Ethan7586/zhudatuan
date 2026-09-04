import { describe, expect, it } from 'vitest';
import { permissionGroups } from './PermissionCatalog';

describe('permissionGroups', () => {
  it.each(['退款', '返款', 'payment.refund'])('finds the refund permission using %s', (query) => {
    const result = permissionGroups(['payment.refund'], query);
    expect(result.flatMap((group) => group.permissions.map((permission) => permission.code))).toEqual(['payment.refund']);
  });

  it('does not expose permissions the current administrator cannot delegate', () => {
    expect(permissionGroups(['access.center.read'], '').flatMap((group) => group.permissions.map((permission) => permission.code))).toEqual(['access.center.read']);
  });
});
