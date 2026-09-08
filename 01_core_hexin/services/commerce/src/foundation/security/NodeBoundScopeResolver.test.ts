import type { Scope } from '@shop/authz';
import { describe, expect, it } from 'vitest';
import type { Actor } from './AccessContext';
import { NodeBoundScopeResolver } from './NodeBoundScopeResolver';

describe('node-bound scope resolver', () => {
  const actor = {} as Actor;
  const scope = { kind: 'mall', id: 'mall:hongtai', path: [] } satisfies Scope;

  it('returns the exact node scope', async () => {
    const resolver = new NodeBoundScopeResolver({ resolve: async () => scope }, scope.id);
    await expect(resolver.resolve(actor, 'catalog.imports.create')).resolves.toBe(scope);
  });

  it('returns an owner scope belonging to the node mall', async () => {
    const owner = { kind: 'owner', id: 'member:one', path: [] } satisfies Scope;
    const resolver = new NodeBoundScopeResolver({ resolve: async () => owner }, scope.id, async () => scope);
    await expect(resolver.resolve(actor, 'member.profile.read')).resolves.toBe(owner);
  });

  it('rejects a valid membership scope from another node', async () => {
    const resolver = new NodeBoundScopeResolver({ resolve: async () => ({ ...scope, id: 'mall-zhudatuan' }) }, scope.id);
    await expect(resolver.resolve(actor, 'catalog.imports.create')).rejects.toThrow('NODE_SCOPE_MISMATCH');
  });

  it('rejects an owner scope belonging to another mall', async () => {
    const owner = { kind: 'owner', id: 'member:one', path: [] } satisfies Scope;
    const otherMall = { ...scope, id: 'mall-zhudatuan' } satisfies Scope;
    const resolver = new NodeBoundScopeResolver({ resolve: async () => owner }, scope.id, async () => otherMall);
    await expect(resolver.resolve(actor, 'member.profile.read')).rejects.toThrow('NODE_SCOPE_MISMATCH');
  });

  it('rejects an owner scope when no node membership resolver is installed', async () => {
    const owner = { kind: 'owner', id: 'member:one', path: [] } satisfies Scope;
    const resolver = new NodeBoundScopeResolver({ resolve: async () => owner }, scope.id);
    await expect(resolver.resolve(actor, 'member.profile.read')).rejects.toThrow('NODE_SCOPE_MISMATCH');
  });
});
