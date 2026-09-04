import type { MembershipAccess, Scope } from '@shop/authz';
import { describe, expect, it } from 'vitest';
import { ResolveMallContext } from './MallContext';

const MALL_A: Scope = Object.freeze({
  kind: 'mall',
  id: 'mall:a',
  tenant: 'tenant:a',
  path: Object.freeze([{ kind: 'platform' as const, id: 'platform:a' }, { kind: 'tenant' as const, id: 'tenant:a' }]),
});
const MALL_B: Scope = Object.freeze({ kind: 'mall', id: 'mall:b', tenant: 'tenant:a', path: Object.freeze([]) });
const OWNER: Scope = Object.freeze({ kind: 'owner', id: 'member:a', path: Object.freeze([]) });

describe('MallContext', () => {
  const resolver = new ResolveMallContext();

  it('creates an immutable context without hierarchy fields', () => {
    const selected = resolver.require(MALL_A, membership(MALL_A));

    expect(selected).toEqual({ mall_id: 'mall:a' });
    expect(Object.isFrozen(selected)).toBe(true);
    expect(Object.keys(selected)).toEqual(['mall_id']);
    expect(selected).not.toHaveProperty('path');
    expect(selected).not.toHaveProperty('parent');
    expect(selected).not.toHaveProperty('level');
  });

  it('keeps the authorized mall when another mall is preferred by request input', () => {
    expect(resolver.require(MALL_A, membership(MALL_A, MALL_B), 'mall:b')).toEqual({ mall_id: 'mall:a' });
  });

  it('resolves a non-mall business scope only from one direct mall grant', () => {
    expect(resolver.require(OWNER, membership(OWNER, MALL_A))).toEqual({ mall_id: 'mall:a' });
    expect(resolver.require(OWNER, membership(OWNER, MALL_A, MALL_B), 'mall:b')).toEqual({ mall_id: 'mall:b' });
  });

  it('does not infer a mall from Scope.path and rejects an ambiguous context', () => {
    const pathOnlyOwner: Scope = Object.freeze({ kind: 'owner', id: 'member:a', path: Object.freeze([MALL_A]) });

    expect(resolver.resolve(pathOnlyOwner, membership(OWNER))).toBeNull();
    expect(() => resolver.require(OWNER, membership(OWNER, MALL_A, MALL_B))).toThrow('SCOPE_DENIED');
  });

  it('restores Job and Event contexts from their explicit mall references', () => {
    const job = resolver.restore({ mall_id: 'mall:job', profile_version: 7 });
    const event = resolver.restore({ mall_id: 'mall:event' });

    expect(job).toEqual({ mall_id: 'mall:job', profile_version: 7 });
    expect(event).toEqual({ mall_id: 'mall:event' });
    expect(Object.isFrozen(job)).toBe(true);
    expect(Object.isFrozen(event)).toBe(true);
  });
});

function membership(...scopes: readonly Scope[]): MembershipAccess {
  return Object.freeze({
    id: 'membership:a',
    active: true,
    accessVersion: 1,
    denies: Object.freeze([]),
    grants: Object.freeze(scopes.map((scope) => Object.freeze({
      scope,
      permissions: Object.freeze(['mall.context.read']),
      effective: '2026-09-01T00:00:00.000Z',
      expires: null,
    }))),
  });
}
