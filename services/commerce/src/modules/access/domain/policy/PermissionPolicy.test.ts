import { describe, expect, it } from 'vitest';
import { PermissionPolicy } from './PermissionPolicy';

describe('PermissionPolicy', () => {
  it('accepts only known delegatable permissions that the issuer effectively allows', () => {
    const policy = new PermissionPolicy();
    expect(() => policy.assertSubset(new Set(['order.read']), new Set(), ['order.read'])).not.toThrow();
    for (const target of [['access.ownership.transfer'], ['unknown.permission'], ['order.create']]) {
      expect(() => policy.assertSubset(new Set(['access.ownership.transfer', 'unknown.permission', 'order.read']), new Set(), target)).toThrow('DELEGATION_DENIED');
    }
    expect(() => policy.assertSubset(new Set(['order.read']), new Set(['order.read']), ['order.read'])).toThrow('DELEGATION_DENIED');
  });
});
